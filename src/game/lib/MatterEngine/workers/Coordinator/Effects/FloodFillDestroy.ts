/// <reference lib="webworker" />
import { EMPTY, matterType } from '../../../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../../../Matter/Tank/_MatterTank.types.ts'
import { FloodFillFrontier } from './FloodFillFrontier.ts'
import { ProjectileDestroy } from './ProjectileDestroy.ts'
import type { EffectResult, ProjectileEffectResult } from './SimProjectile.ts'

export class FloodFillDestroy extends ProjectileDestroy {
  private readonly frontier = new FloodFillFrontier()

  applyFloodFill(
    tileX: number,
    tileY: number,
    ownerId: MatterTankId,
    budget: number,
    slotIdx: number,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): EffectResult {
    const tiles = this.sim.tiles
    const { width, height } = this
    const seedIdx = tileY * width + tileX

    const indices = this.frontier.collect(slotIdx, seedIdx, budget, width, height, (idx) =>
      this.convertTile(matterType(tiles[idx]), EMPTY, ownerId) !== null,
    )

    const candidates: ProjectileEffectResult[] = []
    for (const idx of indices) {
      const x = idx % width
      const y = (idx / width) | 0
      const newValue = this.convertTile(matterType(tiles[idx]), EMPTY, ownerId)
      if (newValue !== null) candidates.push({ x, y, newValue })
    }

    return this._writeCandidates(candidates, EMPTY, activeSet, dirtyChunks)
  }
}
