// Drives the game in a headless browser via Playwright to benchmark
// Coordinator/SimWorkerPool tile-sim throughput under a fixed, deterministic
// load (the BENCH level — a big block of oil baked into the initial tile
// state, see src/game/scenes/Levels/BenchLevel.ts), so perf changes can be
// A/B'd on the exact same scenario instead of eyeballing hand-pasted console
// logs from whatever happened to be on screen.
//
// Usage: node _scripts/bench-sim.mjs [--level=BENCH] [--settle=1000] [--measure=5000] [--port=8081] [--headed]
//
// Relies on the dev-only window.__bench hook (src/game/lib/Debug/BenchmarkHook.ts)
// installed from GameLevel.create(), which exposes the live scene so we can
// read simStats.stepCount directly — the same source GameLevel.ts uses to
// compute uiState.simFps.

import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

function arg(name, fallback) {
  const prefix = `--${name}=`
  const found = process.argv.find((a) => a.startsWith(prefix))
  return found ? Number(found.slice(prefix.length)) : fallback
}

function strArg(name, fallback) {
  const prefix = `--${name}=`
  const found = process.argv.find((a) => a.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

const LEVEL_ID = strArg('level', 'BENCH')

// Defaults to the same port as `pnpm dev` — override with --port when that's
// already occupied by an actual manual dev session, so this doesn't have to
// fight over (or kill) someone's live browser tab.
const DEV_PORT = arg('port', 8081)
const DEV_URL = `http://localhost:${DEV_PORT}`

// Extra settle-in time after the step loop starts advancing, before timing
// begins — the first few steps chew through the initial oil-block drop
// transient (huge one-off activation burst), which isn't representative of
// sustained throughput.
const settleMs = arg('settle', 1000)
const measureMs = arg('measure', 5000)
const headed = process.argv.includes('--headed')
const verbose = process.argv.includes('--verbose')

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`dev server did not come up at ${url} within ${timeoutMs}ms`)
}

// A previous run's orphaned dev server (see devServer kill notes below) would
// otherwise sit on the port silently — waitForServer would then happily
// connect to that STALE server instead of the one this run just spawned,
// which cost real time chasing "why is this hung/stuck" before the actual
// cleanup bugs were found. Fail fast and loud instead.
async function assertPortFree(port) {
  try {
    await fetch(`http://localhost:${port}`)
  } catch {
    return // nothing listening — good
  }
  throw new Error(
    `port ${port} is already in use — a previous bench-sim.mjs run may have `
    + `left an orphaned dev server. Find and kill it before retrying, e.g.:\n`
    + `  lsof -nP -iTCP:${port} -sTCP:LISTEN`,
  )
}

async function main() {
  await assertPortFree(DEV_PORT)

  // detached: true makes devServer the leader of its own process group.
  // `pnpm exec vite` spawns vite as a CHILD node process — signalling just
  // the top-level pnpm pid (as this used to do) leaves that grandchild alive
  // and still holding the port, which is exactly how orphaned dev servers
  // accumulated across runs. Killing the whole group (see finally below)
  // takes everything down together.
  const devServer = spawn('pnpm', ['exec', 'vite', '--config', 'vite/vite.config.dev.ts', '--port', String(DEV_PORT), '--strictPort'], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  let devServerLog = ''
  devServer.stdout.on('data', (d) => { devServerLog += d })
  devServer.stderr.on('data', (d) => { devServerLog += d })

  // browserServer/browser are declared here (not const-assigned before the
  // try) so that if launchServer()/connect() itself hangs or throws, the
  // finally block below still runs and devServer gets killed instead of
  // being orphaned before a browser was ever involved.
  let browserServer
  let browser
  try {
    // Chrome backgrounds/occludes headless pages by default, which throttles
    // the Coordinator's self-scheduling setTimeout(loop, 8) loop down to
    // near-zero — these flags disable that throttling so the sim runs at
    // real speed the same way it would in a foregrounded tab.
    //
    // launchServer() + connect() instead of the simpler chromium.launch():
    // the plain Browser object chromium.launch() returns has no public way
    // to get at (or force-kill) the underlying OS process, and
    // browser.close() has been observed to hang indefinitely in this
    // environment with no recourse once that happens. BrowserServer exposes
    // both process() and a real kill(), so cleanup below can always force
    // the issue.
    browserServer = await chromium.launchServer({
      headless: !headed,
      args: [
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
      ],
    })
    browser = await chromium.connect(browserServer.wsEndpoint())

    await waitForServer(DEV_URL, 20000)

    const page = await browser.newPage()
    const consoleLines = []
    page.on('console', (msg) => {
      consoleLines.push(msg.text())
      if (verbose) console.error('[console]', msg.text())
    })
    page.on('pageerror', (err) => console.error('[page error]', err))
    page.on('crash', () => console.error('[page crashed]'))

    await page.addInitScript((level) => {
      localStorage.setItem('level', level)
    }, LEVEL_ID)

    await page.goto(DEV_URL)
    await page.waitForFunction(() => !!window.__bench, null, { timeout: 20000 })

    // The worker pool (Coordinator + N nested MatterSim workers, each doing
    // full SharedArrayBuffer/tilemap init) can take a while to come up,
    // especially against a cold Vite dev server — wait for the step loop to
    // actually be advancing before timing anything, instead of guessing a
    // fixed startup duration.
    await page.waitForFunction(
      () => window.__bench.scene.io.simStats.stepCount > 5,
      null,
      { timeout: 30000, polling: 50 },
    )

    await page.waitForTimeout(settleMs)

    const { stepCount: step0, t: t0 } = await page.evaluate(() => ({
      stepCount: window.__bench.scene.io.simStats.stepCount,
      t: performance.now(),
    }))

    await page.waitForTimeout(measureMs)

    const { stepCount: step1, t: t1 } = await page.evaluate(() => ({
      stepCount: window.__bench.scene.io.simStats.stepCount,
      t: performance.now(),
    }))

    const elapsedSec = (t1 - t0) / 1000
    const steps = step1 - step0
    const simFps = steps / elapsedSec

    const profileLines = consoleLines.filter((l) => l.includes('[PROFILE'))

    console.log(JSON.stringify({
      simFps: Number(simFps.toFixed(2)),
      steps,
      elapsedSec: Number(elapsedSec.toFixed(3)),
      profileLines: profileLines.slice(-10),
    }, null, 2))
  } finally {
    if (browserServer) {
      // browserServer.kill() has its own internal wait-for-exit, which is
      // exactly what's been observed to hang indefinitely in this
      // environment. Race it against a hard timeout and fall back to
      // SIGKILL-ing the raw process directly (fire-and-forget — don't await
      // process exit again).
      await Promise.race([
        browserServer.kill().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ])
      const browserProc = browserServer.process()
      if (browserProc && browserProc.exitCode === null) {
        browserProc.kill('SIGKILL')
      }
    }

    // Kill the whole devServer process group (negative pid), not just the
    // top-level pnpm process — see the `detached: true` note above.
    try {
      process.kill(-devServer.pid, 'SIGKILL')
    } catch {
      // already dead
    }

    if (process.exitCode) console.error(devServerLog)
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
}).finally(() => {
  // Playwright/Node can leave dangling handles (e.g. from the browser
  // connection) that keep the event loop alive even after all cleanup
  // above completes — without this the process itself joins the pile of
  // things that need to be manually killed after every run.
  process.exit(process.exitCode ?? 0)
})
