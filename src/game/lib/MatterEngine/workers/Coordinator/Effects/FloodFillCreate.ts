/// <reference lib="webworker" />
import { EMPTY, MatterType, matterType } from '../../../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../../../Matter/Tank/_MatterTank.types.ts'
import type { PlayerBounds } from '../../../data/PlayerBoundsData.ts'
import { FloodFillFrontier } from './FloodFillFrontier.ts'
import { ProjectileCreate } from './ProjectileCreate.ts'
import type { EffectResult, ProjectileEffectResult } from './SimProjectile.ts'

export class FloodFillCreate extends ProjectileCreate {
  private readonly frontier = new FloodFillFrontier()

  applyFloodFill(
    tileX: number,
    tileY: number,
    createType: MatterType,
    ownerId: MatterTankId,
    budget: number,
    slotIdx: number,
    playerBounds: PlayerBounds,
    activeSet: Set<number>,
    dirtyChunks: Set<number>,
  ): EffectResult {
    const tiles = this.sim.tiles
    const { width, height } = this
    const seedIdx = tileY * width + tileX
    const neighbors8 = [
      tileX > 0 && tileY > 0 ? seedIdx - width - 1 : -1,
      tileY > 0 ? seedIdx - width : -1,
      tileX < width - 1 && tileY > 0 ? seedIdx - width + 1 : -1,
      tileX > 0 ? seedIdx - 1 : -1,
      tileX < width - 1 ? seedIdx + 1 : -1,
      tileX > 0 && tileY < height - 1 ? seedIdx + width - 1 : -1,
      tileY < height - 1 ? seedIdx + width : -1,
      tileX < width - 1 && tileY < height - 1 ? seedIdx + width + 1 : -1,
    ]

    const indices = this.frontier.collect(slotIdx, seedIdx, budget, width, height, (idx) => {
      const x = idx % width
      const y = (idx / width) | 0
      if (this.shouldSkipTile(x, y, playerBounds, false)) return false
      return matterType(tiles[idx]) === EMPTY
    }, neighbors8)

    const candidates: ProjectileEffectResult[] = []
    for (const idx of indices) {
      const x = idx % width
      const y = (idx / width) | 0
      const newValue = this.convertTile(matterType(tiles[idx]), createType, ownerId)
      if (newValue !== null) candidates.push({ x, y, newValue })
    }

    return this._writeCandidates(candidates, createType, activeSet, dirtyChunks)
  }
}
