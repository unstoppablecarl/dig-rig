/// <reference lib="webworker" />
import {
  ENABLE_MATTER_CONSERVATION_CHECK,
  ENABLE_MATTER_SIM_PROFILING,
  MATTER_CONSERVATION_CHECK_INTERVAL_FRAMES,
  MAX_MATTER_TANKS,
} from '../../../config.ts'
import { FILL_MAX } from '../../Matter/_Liquid.constants.ts'
import {
  BURNING_FUEL,
  EMPTY,
  FIRE,
  isSettled,
  type MatterRaw,
  matterType,
  type MatterValue,
  PHYSICS_BODY,
  STEAM,
} from '../../Matter/_Matter.types.ts'
import { isActivatable, isLiquid, matterFillContribution } from '../../Matter/matter.ts'
import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import type { ParticleType } from '../../Particles/_particle-types.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import { ChunkPublisher } from '../data/ChunkPublisher.ts'
import { SparseTileSet, type TileSet } from '../../Matter/data/SparseTileSet.ts'
import { DataManager } from '../DataManager.ts'
import { MatterCreditTransferBuffer } from './_helpers/MatterCreditTransferBuffer.ts'
import { MatterReservationReleaseBuffer } from './_helpers/MatterReservationReleaseBuffer.ts'
import { type CoordinatorInMsgBrushEraseMatter, type CoordinatorInMsgInit } from './Coordinator.types.ts'
import { Brush } from './Coordinator/Brush.ts'
import { ConservationTracker } from './Coordinator/ConservationTracker.ts'
import { Effects } from './Coordinator/Effects.ts'
import { PhysicsBodyProcessor } from './Coordinator/PhysicsBodyProcessor.ts'
import { PhysicsCollapse } from './Coordinator/PhysicsCollapse.ts'
import { ProjectileProcessor } from './Coordinator/ProjectileProcessor.ts'
import { SimMatterTanks } from './Coordinator/SimMatterTanks.ts'
import { SimWorkerPool } from './Coordinator/SimWorkerPool.ts'
import { TunnelWeapon } from './Coordinator/TunnelWeapon.ts'
import { MatterSim } from './MatterSim/MatterSim.ts'
import { MatterSimScratchData } from './MatterSim/MatterSimScratchData.ts'
import { ParticleSim } from './ParticleSim/ParticleSim.ts'

export class Coordinator {
  private data!: DataManager
  private tilePublisher!: ChunkPublisher
  private sim!: MatterSim
  private physics!: PhysicsCollapse
  private effects!: Effects
  private tunnelWeapon!: TunnelWeapon
  private brush!: Brush
  private workerPool!: SimWorkerPool
  private projectileProcessor!: ProjectileProcessor
  private matterTanks!: SimMatterTanks
  private particleSim!: ParticleSim
  private conservationTracker!: ConservationTracker
  private physicsBodyProcessor!: PhysicsBodyProcessor

  activeSet!: TileSet
  private idleSet!: TileSet
  private pendingActivations: number[] = []
  private readonly _activateTmp = new Set<number>()
  private frame = 0
  private width = 0
  private readonly vfxJustSettled: number[] = []
  private readonly structuralRemovals: number[] = []
  private readonly dirtyChunksThisStep = new Set<number>()
  private _lastConservationTotal: number | null = null
  // Per-tile snapshot from the previous conservation check — diagnostic only, lets a
  // violation be narrowed down to the specific tile(s) whose change wasn't matched by any
  // addDelta call, instead of just the aggregate drift.
  private _prevConservationTiles: Uint32Array | null = null
  private _prevConservationFill: Uint32Array | null = null

  // Profiling state, gated by ENABLE_MATTER_SIM_PROFILING. Tracks real
  // wall-clock time between successive step() invocations (nominal cadence
  // is the 8ms setTimeout in startLoop) so a slowdown in total tick cadence
  // can be correlated with activeSet size.
  private _profLastStepEnd = performance.now()
  private _profWindowStart = performance.now()
  private _profStepCount = 0
  private _profTotalStepDur = 0
  private _profMaxStepDur = 0
  private _profTotalInterval = 0
  private _profMaxInterval = 0
  private _profMaxActiveSet = 0
  // Sub-segment timing to break down the gap between Coordinator's
  // avgStepDur and SimWorkerPool's own avgDur — everything in step() that
  // isn't the parallel worker dispatch itself (brush/tunnel/projectile prep,
  // upward pressure pass, island collapse, particleSim, front-buffer publish).
  private _profTotalPreDispatchDur = 0
  private _profMaxPreDispatchDur = 0
  private _profTotalPostDispatchDur = 0
  private _profMaxPostDispatchDur = 0
  private _profTotalParticleSimDur = 0
  private _profMaxParticleSimDur = 0
  private _profTotalPublishDur = 0
  private _profMaxPublishDur = 0

  init(buffers: CoordinatorInMsgInit, poolSize: number) {

    this.data = new DataManager(buffers)
    this.tilePublisher = new ChunkPublisher(
      buffers.tiles,
      buffers.fill,
      this.data.tileFront,
      this.data.chunkGrid,
      buffers.width,
      buffers.height,
    )
    const { width, height } = buffers
    this.width = width
    const chunkGrid = this.data.chunkGrid

    this.activeSet = new SparseTileSet(width * height)
    this.idleSet = new SparseTileSet(width * height)

    this.sim = new MatterSim()
    this.sim.init(buffers.tiles, buffers.fill, buffers.matterTouched, buffers.chunkGrid, width, height, MatterSimScratchData.makeBuffers(), buffers.particleSpawns)

    this.seedInitialActiveSet()

    this.conservationTracker = new ConservationTracker()
    this.particleSim = new ParticleSim(this.data.tiles, this.data.fill, this.conservationTracker, buffers.particle)
    this.matterTanks = new SimMatterTanks(this.data.matterTankManager)
    this.physics = new PhysicsCollapse(this.sim, chunkGrid, width, height)
    this.effects = new Effects(this.sim, this.physics, this.matterTanks, this.data.playerBounds)
    this.brush = new Brush(width, height, this.sim, this.matterTanks, this.physics, this.effects, this.conservationTracker)
    this.tunnelWeapon = new TunnelWeapon(
      this.effects,
      this.data.tunnelWeapon,
      this.data.playerBounds,
      this.data.vfxParticleDestroy,
      this.data.vfxTileEffect,
      this.sim.tiles,
      this.conservationTracker,
    )

    this.projectileProcessor = new ProjectileProcessor(
      this.data.projectileManager,
      this.data.vfxTileEffect,
      this.effects,
      this.matterTanks,
      this.data.vfxParticleDestroy,
      this.data.vfxParticleCreate,
      this.conservationTracker,
    )
    this.physicsBodyProcessor = new PhysicsBodyProcessor(
      this.data.physicsBodies,
      this.data.tiles,
      chunkGrid,
      this.sim,
      this.particleSim,
      width,
      height,
    )
    this.workerPool = new SimWorkerPool({
      width,
      height,
      poolSize,
      tilesBuffer: buffers.tiles,
      fillBuffer: buffers.fill,
      touchedBuffer: buffers.matterTouched,
      chunkGridBuffers: buffers.chunkGrid,
      particleSpawnBuffer: buffers.particleSpawns,
      onReady: () => this.startLoop(),
    })
  }

  private seedInitialActiveSet() {
    const tiles = this.sim.tiles
    for (let idx = 0; idx < tiles.length; idx++) {
      const raw = tiles[idx]
      if (raw === EMPTY) continue
      const t = matterType(raw)
      if (isActivatable(t) && !isSettled(raw)) {
        this.activeSet.add(idx)
      }
    }
  }

  brushEraseMatter(req: CoordinatorInMsgBrushEraseMatter) {
    this.brush.queueErase(req)
  }

  brushAddMatter(value: MatterRaw, tx: number, ty: number, radius: number) {
    this.brush.queueAdd(value, tx, ty, radius)
  }

  destroy() {
    this.workerPool.terminate()
  }

  private startLoop() {
    const loop = async () => {
      try {
        await this.step()
      } catch (e) {
        console.error('[Coordinator] step() threw, loop continues:', e)
      }
      setTimeout(loop, 8)
    }
    setTimeout(loop, 8)
  }

  private async step() {
    const _profT0 = ENABLE_MATTER_SIM_PROFILING ? performance.now() : 0
    try {
      this.data.simStats.stepCount++
      this.dirtyChunksThisStep.clear()

      // Drain physics-body tile activations written to the SAB by the main thread.
      this.data.activateTiles.drain((idx) => this.sim.activate(idx, this._activateTmp))
      for (const idx of this._activateTmp) this.pendingActivations.push(idx)
      this._activateTmp.clear()

      for (const idx of this.pendingActivations) this.activeSet.add(idx)
      this.pendingActivations.length = 0

      // physicsBodyProcessor uses this coordinator-local sim instance directly
      // (not one of the worker-pool's sim instances that get `leftFirst` wired
      // up via process() below), so it never picks up frame parity unless set
      // here — without this, displacement always cascaded the same direction
      // instead of alternating with the frame counter like the rest of the sim.
      this.sim.leftFirst = (this.frame % 2) === 0
      this.physicsBodyProcessor.process(this.activeSet)

      this.data.particleSpawns.drain((
        type: ParticleType,
        x: number,
        y: number,
        ownerId?: MatterTankId,
        vx?: number,
        vy?: number,
        value?: MatterValue,
      ) => {
        this.particleSim.spawn(type, x, y, ownerId, vx, vy, value)
      })

      if (
        this.activeSet.size === 0 &&
        !this.brush.hasWork() &&
        !this.tunnelWeapon.hasWork() &&
        !this.projectileProcessor.hasWork() &&
        this.particleSim.pool.isEmpty &&
        !this.sim.hasDrainWatchWork
      ) {
        return
      }

      const frame = this.frame++
      const leftFirst = (frame % 2) === 0
      this.matterTanks.setFrame(frame)

      // Swap active/idle sets so new activations land in the fresh set.
      const snapshot = this.activeSet
      this.activeSet = this.idleSet
      this.idleSet = snapshot
      this.activeSet.clear()

      let structuralDirty = false

      const _profPreT0 = ENABLE_MATTER_SIM_PROFILING ? performance.now() : 0

      // Drain brush add-matter queue.
      structuralDirty ||= this.brush.stepCreate(this.activeSet, this.dirtyChunksThisStep)

      // Drain brush erase queue — writes committed before sim rounds so workers see them.
      const brushErase = this.brush.stepErase(this.activeSet, this.dirtyChunksThisStep)
      for (const { tiles, structuralDirty: eDirty } of brushErase) {
        structuralDirty ||= eDirty
        if (tiles.length > 0) {
          this.data.vfxTileEffect.writeFireModeTiles(tiles, FireMode.DESTROY)
        }
      }

      structuralDirty ||= this.tunnelWeapon.step(this.activeSet, this.dirtyChunksThisStep)

      // Process active projectile slots — debits/credits tanks, emits VFX, recomputes pending.
      structuralDirty ||= this.projectileProcessor.step(this.activeSet, this.dirtyChunksThisStep)
      this.vfxJustSettled.length = 0
      this.structuralRemovals.length = 0

      if (ENABLE_MATTER_SIM_PROFILING) {
        const _profPreDur = performance.now() - _profPreT0
        this._profTotalPreDispatchDur += _profPreDur
        if (_profPreDur > this._profMaxPreDispatchDur) this._profMaxPreDispatchDur = _profPreDur
      }

      const dirtyChunksThisStep = await this.workerPool.step(snapshot, leftFirst, frame, (results) => {
        for (const r of results) {
          for (const idx of r.next) this.activeSet.add(idx)
          for (const idx of r.vfxJustSettled) this.vfxJustSettled.push(idx)
          for (const idx of r.structuralRemovals) this.structuralRemovals.push(idx)
          MatterCreditTransferBuffer.readBuffer(r.matterTankTransfers, (x, y, ownerId, fill) => {
            if (fill > 0) {
              // Liquid tile self-destruct: credit fill units to liquidMatter, not solid tank.
              this.matterTanks.addLiquidMatter(ownerId, fill)
              this.conservationTracker.addDelta(fill)
            } else {
              this.matterTanks.addCredit(ownerId, 1)
              // Net unified delta = 0: tile destroyed (−FILL_MAX, in solidNetDelta) + tank credit (+FILL_MAX).
            }
            this.data.vfxParticleDestroy.writeTile(x, y, ownerId)
          })
          MatterReservationReleaseBuffer.readBuffer(r.matterReservationReleases, (ownerId, amount) => {
            this.matterTanks.releaseDestroyCharge(ownerId, amount, 'self-destruct')
          })
          this.conservationTracker.addDelta(r.solidNetDelta * FILL_MAX + r.liquidNetDelta)
        }
      })

      const _profPostT0 = ENABLE_MATTER_SIM_PROFILING ? performance.now() : 0

      // Bottom-up upward pressure cascade — runs after all worker rounds so
      // there are no concurrent writers to tiles/fill. Cascades overfull liquid
      // columns to their full height in one pass (fixes slow U-tube equalization).
      this.sim.doUpwardPressureProcessor(this.activeSet)

      // sweeps each active liquid row
      // in one pass so a disturbance can cross a whole wide pool in a
      // single tick instead of tryFillFlow's nearest-neighbor-only exchange
      // taking O(pool width) ticks.
      this.sim.doHorizontalCascadeProcessor(this.activeSet, frame)

      // These two passes run on this.sim directly, not through process(), so
      // their mass-tracking counters need their own read+reset here.
      const { solidNetDelta, liquidNetDelta } = this.sim.consumeNetDelta()
      this.conservationTracker.addDelta(solidNetDelta * FILL_MAX + liquidNetDelta)

      if (this.structuralRemovals.length > 0) {
        const w = this.width
        const xy: { x: number, y: number }[] = []
        for (const idx of this.structuralRemovals) {
          xy.push({ x: idx % w, y: (idx / w) | 0 })
          dirtyChunksThisStep.add(this.physics.chunkIdxForTile(idx))
        }
        const islands = this.physics.findNewlyDisconnected(xy, dirtyChunksThisStep)
        if (islands.length > 0) {
          this.physics.collapseIslands(islands, this.activeSet, dirtyChunksThisStep)
          structuralDirty = true
        }
      }

      for (const idx of this.vfxJustSettled) {
        if (this.activeSet.has(idx)) continue
        const x = idx % this.width
        const y = (idx / this.width) | 0
        this.data.vfxSettledTile.writeTile(x, y, matterType(this.sim.tiles[idx]))
      }

      const overflows = this.matterTanks.flushCredit()
      for (let i = 0; i < overflows.length; i += 3) {
        const from = overflows[i] as MatterTankId
        const to = overflows[i + 1] as MatterTankId
        const amount = overflows[i + 2]
        this.data.vfxParticleOverflow.write(from, to, amount)
      }

      for (const idx of this.dirtyChunksThisStep) dirtyChunksThisStep.add(idx)
      this.physics.postStep(dirtyChunksThisStep, structuralDirty)

      if (ENABLE_MATTER_SIM_PROFILING) {
        const _profPostDur = performance.now() - _profPostT0
        this._profTotalPostDispatchDur += _profPostDur
        if (_profPostDur > this._profMaxPostDispatchDur) this._profMaxPostDispatchDur = _profPostDur
      }

      const _profParticleT0 = ENABLE_MATTER_SIM_PROFILING ? performance.now() : 0

      this.particleSim.step()
      for (const idx of this.particleSim.pendingActivations) {
        this.pendingActivations.push(idx)
      }
      if (this.particleSim.structuralRemovals.length > 0) {
        const w = this.width
        const xy: { x: number, y: number }[] = []
        for (const idx of this.particleSim.structuralRemovals) {
          xy.push({ x: idx % w, y: (idx / w) | 0 })
          dirtyChunksThisStep.add(this.physics.chunkIdxForTile(idx))
        }
        const islands = this.physics.findNewlyDisconnected(xy, dirtyChunksThisStep)
        if (islands.length > 0) {
          this.physics.collapseIslands(islands, this.activeSet, dirtyChunksThisStep)
        }
      }

      if (ENABLE_MATTER_SIM_PROFILING) {
        const _profParticleDur = performance.now() - _profParticleT0
        this._profTotalParticleSimDur += _profParticleDur
        if (_profParticleDur > this._profMaxParticleSimDur) this._profMaxParticleSimDur = _profParticleDur
      }

      if (ENABLE_MATTER_CONSERVATION_CHECK && frame % MATTER_CONSERVATION_CHECK_INTERVAL_FRAMES === 0) {
        this.checkMatterConservation()
      }

      const _profPublishT0 = ENABLE_MATTER_SIM_PROFILING ? performance.now() : 0

      // Publish all chunks whose renderGen changed this step to the front buffers.
      // Atomics.add in publish() is the release fence; the renderer's Atomics.load
      // is the acquire — so the renderer always sees a complete post-step snapshot.
      this.tilePublisher.publish(this.data.chunkGrid)

      if (ENABLE_MATTER_SIM_PROFILING) {
        const _profPublishDur = performance.now() - _profPublishT0
        this._profTotalPublishDur += _profPublishDur
        if (_profPublishDur > this._profMaxPublishDur) this._profMaxPublishDur = _profPublishDur
      }
    } finally {
      // Logs a 1s-aggregated summary of total step() duration and real
      // inter-step interval, correlated with activeSet size, so an overall
      // tick-cadence slowdown can be distinguished from the per-round-trip
      // cost measured inside SimWorkerPool. Gated behind
      // ENABLE_MATTER_SIM_PROFILING — no-op (not even a performance.now()
      // call) when disabled.
      if (ENABLE_MATTER_SIM_PROFILING) {
        const _profNow = performance.now()
        const _profDur = _profNow - _profT0
        const _profInterval = _profNow - this._profLastStepEnd
        this._profLastStepEnd = _profNow
        this._profStepCount++
        this._profTotalStepDur += _profDur
        if (_profDur > this._profMaxStepDur) this._profMaxStepDur = _profDur
        this._profTotalInterval += _profInterval
        if (_profInterval > this._profMaxInterval) this._profMaxInterval = _profInterval
        if (this.activeSet.size > this._profMaxActiveSet) this._profMaxActiveSet = this.activeSet.size
        if (_profNow - this._profWindowStart > 1000) {
          const n = this._profStepCount || 1
          console.log(
            `[PROFILE Coordinator] steps=${this._profStepCount} `
            + `avgStepDur=${(this._profTotalStepDur / n).toFixed(2)}ms maxStepDur=${this._profMaxStepDur.toFixed(2)}ms `
            + `avgInterval=${(this._profTotalInterval / n).toFixed(2)}ms maxInterval=${this._profMaxInterval.toFixed(2)}ms `
            + `maxActiveSetSize=${this._profMaxActiveSet} `
            + `| preDispatch avg=${(this._profTotalPreDispatchDur / n).toFixed(2)}ms max=${this._profMaxPreDispatchDur.toFixed(2)}ms `
            + `postDispatch avg=${(this._profTotalPostDispatchDur / n).toFixed(2)}ms max=${this._profMaxPostDispatchDur.toFixed(2)}ms `
            + `particleSim avg=${(this._profTotalParticleSimDur / n).toFixed(2)}ms max=${this._profMaxParticleSimDur.toFixed(2)}ms `
            + `publish avg=${(this._profTotalPublishDur / n).toFixed(2)}ms max=${this._profMaxPublishDur.toFixed(2)}ms`,
          )
          this._profWindowStart = _profNow
          this._profStepCount = 0
          this._profTotalStepDur = 0
          this._profMaxStepDur = 0
          this._profTotalInterval = 0
          this._profMaxInterval = 0
          this._profMaxActiveSet = 0
          this._profTotalPreDispatchDur = 0
          this._profMaxPreDispatchDur = 0
          this._profTotalPostDispatchDur = 0
          this._profMaxPostDispatchDur = 0
          this._profTotalParticleSimDur = 0
          this._profMaxParticleSimDur = 0
          this._profTotalPublishDur = 0
          this._profMaxPublishDur = 0
        }
      }
    }
  }

  // All matter is measured in fill units: 1 solid tile = FILL_MAX.
  // Solid tiles, liquid fill, steam fill, and tank reserves all contribute to one total.
  private computeMatterTotal(): number {
    const tiles = this.sim.tiles
    const fill = this.sim.fill
    let total = 0
    for (let i = 0, n = tiles.length; i < n; i++) {
      if (tiles[i] === EMPTY) continue
      const t = matterType(tiles[i])
      if (isLiquid(t) || t === STEAM) {
        total += fill[i]
      } else if (t !== FIRE && t !== PHYSICS_BODY && t !== BURNING_FUEL) {
        total += FILL_MAX
      }
    }
    const tankData = this.data.matterTankManager
    for (let id = 0; id < MAX_MATTER_TANKS; id++) {
      const tankId = id as MatterTankId
      if (tankData.getMatterMax(tankId) === 0) continue
      total += tankData.getMatter(tankId) * FILL_MAX
      total += tankData.getLiquidMatter(tankId)
    }
    return total
  }

  // Dev-only invariant checker.
  private checkMatterConservation() {
    const total = this.computeMatterTotal()
    const delta = this.conservationTracker.consumeDelta()

    if (this._lastConservationTotal !== null) {
      const expected = this._lastConservationTotal + delta
      if (total !== expected) {
        console.error(`[Coordinator] conservation violated: expected ${expected}, got ${total} (drift ${total - expected})`)
        this.logConservationDiff()
      }
    }

    this._lastConservationTotal = total
    this._prevConservationTiles = this.sim.tiles.slice()
    this._prevConservationFill = this.sim.fill.slice()
  }

  // Diagnostic: diffs the current tiles/fill against the snapshot taken at the previous
  // check and prints every tile whose fill-unit contribution changed, so a violation can be
  // traced to the specific untracked tile(s) instead of just the aggregate drift number.
  private logConservationDiff() {
    const prevTiles = this._prevConservationTiles
    const prevFill = this._prevConservationFill
    if (!prevTiles || !prevFill) return

    const tiles = this.sim.tiles
    const fill = this.sim.fill
    const width = this.width
    const changed: { idx: number, dx: number, dy: number, prevRaw: number, raw: number, prevFill: number, fill: number, contribDelta: number }[] = []

    for (let i = 0, n = tiles.length; i < n; i++) {
      const before = matterFillContribution(prevTiles[i], prevFill[i])
      const after = matterFillContribution(tiles[i], fill[i])
      if (before !== after) {
        changed.push({
          idx: i,
          dx: i % width,
          dy: (i / width) | 0,
          prevRaw: prevTiles[i],
          raw: tiles[i],
          prevFill: prevFill[i],
          fill: fill[i],
          contribDelta: after - before,
        })
      }
    }

    changed.sort((a, b) => Math.abs(b.contribDelta) - Math.abs(a.contribDelta))
    const shown = changed.slice(0, 40)
    console.log(
      `[Coordinator] conservation diff: ${changed.length} tile(s) changed since last check `
      + `(sum of contribDelta = ${changed.reduce((s, c) => s + c.contribDelta, 0)}), showing top ${shown.length}:`,
    )
    for (const c of shown) {
      console.log(
        `  (${c.dx},${c.dy}) idx=${c.idx}: raw ${c.prevRaw}->${c.raw} fill ${c.prevFill}->${c.fill} contribDelta=${c.contribDelta}`,
      )
    }
  }
}
