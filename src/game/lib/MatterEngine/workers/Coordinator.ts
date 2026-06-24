/// <reference lib="webworker" />
import { matterType, MatterType } from '../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import { DataManager } from '../DataManager.ts'
import { MatterCreditTransferBuffer } from './_helpers/MatterCreditTransferBuffer.ts'
import { type CoordinatorInMsgBrushEraseMatter, type CoordinatorInMsgInit } from './Coordinator.types.ts'
import { Brush } from './Coordinator/Brush.ts'
import { Effects } from './Coordinator/Effects.ts'
import { Physics } from './Coordinator/Physics.ts'
import { ProjectileProcessor } from './Coordinator/ProjectileProcessor.ts'
import { SimMatterTanks } from './Coordinator/SimMatterTanks.ts'
import { SimWorkerPool } from './Coordinator/SimWorkerPool.ts'
import { TunnelWeapon } from './Coordinator/TunnelWeapon.ts'
import { MatterSim } from './MatterSim/MatterSim.ts'
import { ParticleSim } from './ParticleSim/ParticleSim.ts'

export class Coordinator {
  private data!: DataManager
  private sim!: MatterSim
  private physics!: Physics
  private effects!: Effects
  private tunnelWeapon!: TunnelWeapon
  private brush!: Brush
  private workerPool!: SimWorkerPool
  private projectileProcessor!: ProjectileProcessor
  private matterTanks!: SimMatterTanks
  private particleSim!: ParticleSim

  activeSet = new Set<number>()
  private idleSet = new Set<number>()
  private pendingActivations: number[] = []
  private frame = 0
  private width = 0
  private readonly vfxJustSettled: number[] = []
  private readonly destroyedTiles: number[] = []
  private readonly dirtyChunksThisStep = new Set<number>()

  init(buffers: CoordinatorInMsgInit, poolSize: number) {

    this.data = new DataManager(buffers)
    const { width, height } = buffers
    this.width = width

    this.sim = new MatterSim()

    const chunkGrid = this.data.chunkGrid
    this.sim.init(buffers.tiles, buffers.chunkGrid, width, height)

    this.particleSim = new ParticleSim()
    this.particleSim.init({ tiles: buffers.tiles, particleBuffers: buffers.particle })

    this.matterTanks = new SimMatterTanks(this.data.matterTankManager)
    this.physics = new Physics(this.sim, chunkGrid, width, height)
    this.effects = new Effects(this.sim, this.physics, this.data.playerBounds, width, height)
    this.tunnelWeapon = new TunnelWeapon(
      this.effects, this.data.tunnelWeapon,
      this.data.playerBounds, this.data.vfxParticleDestroy, this.data.vfxTileEffect, this.sim.tiles, width, height,
    )
    this.brush = new Brush(width, height, this.sim, this.physics, this.effects)

    this.projectileProcessor = new ProjectileProcessor(
      this.data.projectileManager,
      this.data.vfxTileEffect,
      this.effects,
      this.matterTanks,
      this.data.vfxParticleDestroy,
      this.data.vfxParticleCreate,
    )
    this.workerPool = new SimWorkerPool({
      width,
      height,
      poolSize,
      tilesBuffer: buffers.tiles,
      chunkGridBuffers: buffers.chunkGrid,
      onReady: () => this.startLoop(),
      onSpawnParticle: (msg) => {
        this.particleSim.spawn(msg.particleType, msg.x, msg.y, msg.ownerId)
      },
    })
  }

  brushEraseMatter(req: CoordinatorInMsgBrushEraseMatter) {
    this.brush.queueErase(req)
  }

  brushAddMatter(value: MatterType, tx: number, ty: number, radius: number) {
    this.brush.queueAdd(value, tx, ty, radius)
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
    this.dirtyChunksThisStep.clear()

    for (const idx of this.pendingActivations) this.activeSet.add(idx)
    this.pendingActivations.length = 0

    if (
      this.activeSet.size === 0 &&
      !this.brush.hasWork() &&
      !this.tunnelWeapon.hasWork() &&
      !this.projectileProcessor.hasWork() &&
      this.particleSim.pool.isEmpty
    ) return

    const frame = this.frame++
    const leftFirst = (frame % 2) === 0

    // Swap active/idle sets so new activations land in the fresh set.
    const snapshot = this.activeSet
    this.activeSet = this.idleSet
    this.idleSet = snapshot
    this.activeSet.clear()

    let structuralDirty = false

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
    this.destroyedTiles.length = 0

    const dirtyChunksThisStep = await this.workerPool.step(snapshot, leftFirst, frame, (results) => {
      for (const r of results) {
        for (const idx of r.next) this.activeSet.add(idx)
        for (const idx of r.vfxJustSettled) this.vfxJustSettled.push(idx)
        for (const idx of r.destroyedTiles) this.destroyedTiles.push(idx)
        MatterCreditTransferBuffer.readBuffer(r.matterTankTransfers, (x, y, ownerId) => {
          this.matterTanks.addCredit(ownerId, 1)
          this.data.vfxParticleDestroy.writeTile(x, y, ownerId)
        })
      }
    })

    if (this.destroyedTiles.length > 0) {
      const w = this.width
      const xy = this.destroyedTiles.map(idx => ({ x: idx % w, y: (idx / w) | 0 }))
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

    this.particleSim.step()
    for (const idx of this.particleSim.pendingActivations) {
      this.pendingActivations.push(idx)
    }
  }
}
