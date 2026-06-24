/// <reference lib="webworker" />
import { matterType, MatterType } from '../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import { DataManager } from '../DataManager.ts'
import { MatterCreditTransferBuffer } from './_helpers/MatterCreditTransferBuffer.ts'
import {
  type CoordinatorInMsgBrushEraseMatter,
  type CoordinatorInMsgInit,
  type CoordinatorOutMessage,
} from './Coordinator.types.ts'
import { Brush } from './Coordinator/Brush.ts'
import { Effects } from './Coordinator/Effects.ts'
import { Physics } from './Coordinator/Physics.ts'
import { ProjectileProcessor } from './Coordinator/ProjectileProcessor.ts'
import { SimMatterTanks } from './Coordinator/SimMatterTanks.ts'
import { SimWorkerPool } from './Coordinator/SimWorkerPool.ts'
import { TunnelWeapon } from './Coordinator/TunnelWeapon.ts'
import { MatterSim } from './MatterSim/MatterSim.ts'

export class Coordinator {
  constructor(private readonly post: (msg: CoordinatorOutMessage, transfer?: Transferable[]) => void) {
  }

  private data!: DataManager
  private sim!: MatterSim
  private physics!: Physics
  private effects!: Effects
  private tunnelWeapon!: TunnelWeapon
  private brush!: Brush
  private workerPool!: SimWorkerPool
  private projectileProcessor!: ProjectileProcessor
  private matterTanks!: SimMatterTanks

  activeSet = new Set<number>()
  private idleSet = new Set<number>()
  private pendingActivations: number[] = []
  private frame = 0
  private width = 0
  private readonly vfxJustSettled: number[] = []
  private readonly _dirtyChunksThisStep = new Set<number>()

  init(buffers: CoordinatorInMsgInit, poolSize: number) {

    this.data = new DataManager(buffers)
    const { width, height } = buffers
    this.width = width

    this.sim = new MatterSim()

    const chunkGrid = this.data.chunkGrid
    const { chunksWide, chunksHigh } = chunkGrid
    this.sim.init(buffers.tiles, buffers.chunkGrid, width, height)

    this.matterTanks = new SimMatterTanks(this.data.matterTankManager)
    this.physics = new Physics(this.sim, chunkGrid, width, height, chunksWide, chunksHigh)
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
      chunksWide,
      poolSize,
      tilesBuffer: buffers.tiles,
      chunkGridBuffers: buffers.chunkGrid,
      onReady: () => this.startLoop(),
      onForward: (msg) => this.post(msg),
    })
  }

  brushEraseMatter(req: CoordinatorInMsgBrushEraseMatter) {
    this.brush.enqueueErase(req)
  }

  brushAddMatter(value: MatterType, tx: number, ty: number, radius: number) {
    this.brush.enqueue(value, tx, ty, radius)
  }

  activateTiles(indices: number[]) {
    for (const idx of indices) this.pendingActivations.push(idx)
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
    this._dirtyChunksThisStep.clear()

    for (const idx of this.pendingActivations) this.activeSet.add(idx)
    this.pendingActivations.length = 0

    if (
      this.activeSet.size === 0 &&
      !this.brush.hasWork() &&
      !this.tunnelWeapon.hasWork() &&
      !this.projectileProcessor.hasWork()
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
    structuralDirty ||= this.brush.stepCreate(this.activeSet, this._dirtyChunksThisStep)

    // Drain brush erase queue — writes committed before sim rounds so workers see them.
    const brushErase = this.brush.stepErase(this.activeSet, this._dirtyChunksThisStep)
    for (const { tiles, structuralDirty: eDirty } of brushErase) {
      structuralDirty ||= eDirty
      if (tiles.length > 0) {
        this.data.vfxTileEffect.writeFireModeTiles(tiles, FireMode.DESTROY)
      }
    }

    structuralDirty ||= this.tunnelWeapon.step(this.activeSet, this._dirtyChunksThisStep)

    // Process active projectile slots — debits/credits tanks, emits VFX, recomputes pending.
    structuralDirty ||= this.projectileProcessor.step(this.activeSet, this._dirtyChunksThisStep)
    this.vfxJustSettled.length = 0

    const dirtyChunksThisStep = await this.workerPool.step(snapshot, leftFirst, frame, (results) => {
      for (const r of results) {
        for (const idx of r.next) this.activeSet.add(idx)
        for (const idx of r.vfxJustSettled) this.vfxJustSettled.push(idx)
        MatterCreditTransferBuffer.readBuffer(r.matterTankTransfers, (x, y, ownerId) => {
          this.matterTanks.addCredit(ownerId, 1)
          this.data.vfxParticleDestroy.writeTile(x, y, ownerId)
        })
      }
    })

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

    for (const idx of this._dirtyChunksThisStep) dirtyChunksThisStep.add(idx)
    this.physics.postStep(dirtyChunksThisStep, structuralDirty)
  }
}
