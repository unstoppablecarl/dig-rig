/// <reference lib="webworker" />
import { FILL_MAX } from '../../../Matter/_Liquid.constants.ts'
import { EMPTY, getOwner, type MatterRaw, matterType, PLANT, SupportType } from '../../../Matter/_Matter.types.ts'
import { getReserveDestroyAmount, getSupportType, isLiquid } from '../../../Matter/matter.ts'
import type { Tile } from '../../../Tilemap/TileGrid.ts'
import type { CoordinatorInMsgBrushEraseMatter } from '../Coordinator.types.ts'
import { MatterSim } from '../MatterSim/MatterSim.ts'
import type { ConservationTracker } from './ConservationTracker.ts'
import type { Effects } from './Effects.ts'
import type { EffectResult } from './Effects/SimProjectile.ts'
import type { PhysicsCollapse } from './PhysicsCollapse.ts'
import { SimMatterTanks } from './SimMatterTanks.ts'

type BrushEntry = { value: MatterRaw; tx: number; ty: number; radius: number }

export class Brush {
  private readonly queue: BrushEntry[] = []
  private readonly eraseQueue: CoordinatorInMsgBrushEraseMatter[] = []

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly sim: MatterSim,
    private readonly matterTanks: SimMatterTanks,
    private readonly physics: PhysicsCollapse,
    private readonly effects: Effects,
    private readonly tracker: ConservationTracker,
  ) {
  }

  hasWork(): boolean {
    return this.queue.length > 0 || this.eraseQueue.length > 0
  }

  queueAdd(value: MatterRaw, tx: number, ty: number, radius: number) {
    this.queue.push({ value, tx, ty, radius })
  }

  queueErase(req: CoordinatorInMsgBrushEraseMatter) {
    this.eraseQueue.push(req)
  }

  private _stepErase: EffectResult[] = []

  stepErase(activeSet: Set<number>, dirtyChunks: Set<number>): EffectResult[] {
    const result = this._stepErase
    result.length = 0
    if (this.eraseQueue.length === 0) return result
    for (const req of this.eraseQueue) {
      const erased = this.effects.applyBrushErase(req, activeSet, dirtyChunks)
      this.tracker.addDelta(erased.solidDomainDelta * FILL_MAX + erased.liquidDomainDelta)
      result.push(erased)
    }
    this.eraseQueue.length = 0
    return result
  }

  stepCreate(activeSet: Set<number>, dirtyChunks: Set<number>): boolean {
    if (this.queue.length === 0) return false
    let structuralDirty = false
    for (const { value, tx, ty, radius } of this.queue) {
      structuralDirty ||= this.processAddMatter(value, tx, ty, radius, activeSet, dirtyChunks)
    }

    this.queue.length = 0
    return structuralDirty
  }

  private _processAddMatter: Tile[] = []

  private processAddMatter(
    value: MatterRaw,
    tx: number, ty: number, radius: number,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): boolean {
    const tiles = this.sim.tiles
    const { width, height } = this
    this._processAddMatter.length = 0
    const placed = this._processAddMatter
    const r2 = radius * radius

    const addingType = matterType(value)
    const addingLiquid = isLiquid(addingType)

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue
        const x = tx + dx
        const y = ty + dy
        if (x < 0 || x >= width || y < 0 || y >= height) continue
        const idx = y * width + x
        if ((x+y) % 2 === 0) continue
        if (matterType(tiles[idx]) !== EMPTY) continue

        if (addingType === PLANT) {
          activeSet.add(idx)
        }

        tiles[idx] = value
        if (addingLiquid) {
          this.sim.fill[idx] = FILL_MAX
          // Liquid painted into empty space never affects collidability —
          // render-only. Solids still get the real bump since freshly-placed
          // solid matter is the common brush case that needs terrain collision.
          this.sim.markRenderDirty(x, y)
        } else {
          this.sim.markDirty(x, y)
        }
        dirtyChunks.add(this.physics.chunkIdxForTile(idx))
        placed.push({ x, y })
        this.sim.activate(idx, activeSet)
      }
    }

    this.tracker.addDelta(placed.length * FILL_MAX)
    const reserveAmount = getReserveDestroyAmount(addingType)
    if (reserveAmount > 0) {
      const ownerId = getOwner(value)
      this.matterTanks.reserveDestroyCharge(ownerId, reserveAmount * placed.length, 'create')
    }

    if (getSupportType(value) >= SupportType.STRUCTURAL) {
      const islands = this.physics.findIslandTiles(placed)
      if (islands.length > 0) {
        this.physics.collapseIslands(islands, activeSet, dirtyChunks)
      }
      return true
    }
    return false
  }
}
