import type { GameLevel } from '../../scenes/GameLevel.ts'

declare global {
  interface Window {
    __bench?: { scene: GameLevel }
  }
}

// Dev-only hook for scripted Playwright benchmarks (see _scripts/bench-sim.mjs).
// Exposes the live scene so a script can trigger deterministic brush strokes
// and read simStats.stepCount directly, instead of simulating pixel-perfect
// mouse input. Only wired up from GameLevel.create() behind
// `import.meta.env.DEV`, so it never reaches production builds.
export function installBenchmarkHook(scene: GameLevel) {
  window.__bench = { scene }
}
