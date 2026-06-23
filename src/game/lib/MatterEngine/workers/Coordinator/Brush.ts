/// <reference lib="webworker" />
import { EMPTY, matterType, type MatterType, PLANT, SupportType } from '../../../Matter/_Matter.types.ts'
import { getSupportType } from '../../../Matter/matter.ts'
import type { Tile } from '../../../Tilemap/TileGrid.ts'
import type { CoordinatorInMsgBrushEraseMatter } from '../Coordinator.types.ts'
import { MatterSim } from '../MatterSim/MatterSim.ts'
import type { Effects } from './Effects.ts'
import type { EffectResult } from './Effects/SimProjectile.ts'
import type { Physics } from './Physics.ts'

type BrushEntry = { value: MatterType; tx: number; ty: number; radius: number }

export class Brush {
  private readonly queue: BrushEntry[] = []
  private readonly eraseQueue: CoordinatorInMsgBrushEraseMatter[] = []

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly sim: MatterSim,
    private readonly physics: Physics,
    private readonly effects: Effects,
  ) {
  }

  hasWork(): boolean {
    return this.queue.length > 0 || this.eraseQueue.length > 0
  }

  enqueue(value: MatterType, tx: number, ty: number, radius: number) {
    this.queue.push({ value, tx, ty, radius })
  }

  enqueueErase(req: CoordinatorInMsgBrushEraseMatter) {
    this.eraseQueue.push(req)
  }

  private _stepErase: EffectResult[] = []

  stepErase(activeSet: Set<number>, dirtyChunks: Set<number>): EffectResult[] {
    const result = this._stepErase
    result.length = 0
    if (this.eraseQueue.length === 0) return result
    for (const req of this.eraseQueue) {
      result.push(this.effects.applyBrushErase(req, activeSet, dirtyChunks))
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
    value: MatterType,
    tx: number, ty: number, radius: number,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): boolean {
    const tiles = this.sim.tiles
    const { width, height } = this
    this._processAddMatter.length = 0
    const placed = this._processAddMatter
    const r2 = radius * radius

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue
        const x = tx + dx
        const y = ty + dy
        if (x < 0 || x >= width || y < 0 || y >= height) continue
        const idx = y * width + x
        if (matterType(tiles[idx]) !== EMPTY) continue

        if (matterType(value) === PLANT) {
          activeSet.add(idx)
        }

        tiles[idx] = value
        this.sim.markDirty(x, y)
        dirtyChunks.add(this.physics.chunkIdxForTile(idx))
        placed.push({ x, y })
        this.sim.activate(idx, activeSet)
      }
    }

    if (getSupportType(value) >= SupportType.STRUCTURAL) {
      const islands = this.physics.findIslandTiles(placed)
      if (islands.length > 0) this.physics.collapseIslands(islands, activeSet, dirtyChunks)
      return true
    }
    return false
  }
}
