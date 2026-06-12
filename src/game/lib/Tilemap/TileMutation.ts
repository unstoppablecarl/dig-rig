import { matterType } from '../Matter/_Matter.types.ts'
import type { MatterTankId } from '../Matter/MatterTank/_MatterTank.types.ts'
import type {
  ProjectileEffect,
  ProjectileEffectResult,
} from '../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import type { Tilemap } from './Tilemap.ts'

export function applyEffect(
  tilemap: Tilemap,
  out: ProjectileEffectResult[],
  tileX: number,
  tileY: number,
  tileRadius: number,
  effect: ProjectileEffect,
  ownerId?: MatterTankId,
  tilesToModify = Number.MAX_VALUE,
  innerRadius = 0,
  visited?: Set<number>,
): ProjectileEffectResult[] {
  out.length = 0

  tilemap.getCircle(tileX, tileY, tileRadius, (x, y) => {
    if (visited?.has(y * tilemap.width + x)) return
    if (effect.filterTile && !effect.filterTile(tilemap, x, y)) return
    const existing = matterType(tilemap.getTile(x, y))
    const newValue = effect.convertMatterType(existing, ownerId)
    if (newValue === null) return

    out.push({ x, y, newValue })
  }, false, innerRadius)

  const changed = commitTiles(tilemap, out, tileX, tileY, tilesToModify)
  if (!changed) return out

  if (visited) {
    for (const { x, y } of out) visited.add(y * tilemap.width + x)
  }

  effect.onTilesCommitted(tilemap, out)
  return out
}

function commitTiles(
  tilemap: Tilemap,
  tiles: ProjectileEffectResult[],
  tileX: number,
  tileY: number,
  tilesToModify: number,
): boolean {
  if (tilesToModify < tiles.length) {
    tiles.sort((a, b) =>
      ((a.x - tileX) ** 2 + (a.y - tileY) ** 2) - ((b.x - tileX) ** 2 + (b.y - tileY) ** 2),
    )
  }
  truncatePreservingCenter(tiles, tileX, tileY, tilesToModify)
  if (!tiles.length) return false
  for (const { x, y, newValue } of tiles) {
    tilemap.setTile(x, y, newValue)
  }
  return true
}

// Keeps the inner core intact and randomly samples only the outermost ring.
function truncatePreservingCenter<T extends { x: number; y: number }>(
  tiles: T[],
  tileX: number,
  tileY: number,
  targetSize: number,
): void {
  if (targetSize <= 0) {
    tiles.length = 0
    return
  }
  if (targetSize >= tiles.length) return

  const last = tiles[targetSize - 1]
  const cutoffD2 = (last.x - tileX) ** 2 + (last.y - tileY) ** 2

  let ringStart = targetSize - 1
  while (ringStart > 0 && (tiles[ringStart - 1].x - tileX) ** 2 + (tiles[ringStart - 1].y - tileY) ** 2 === cutoffD2) {
    ringStart--
  }

  let ringEnd = targetSize
  while (ringEnd < tiles.length && (tiles[ringEnd].x - tileX) ** 2 + (tiles[ringEnd].y - tileY) ** 2 === cutoffD2) {
    ringEnd++
  }

  // Partial Fisher-Yates: randomly select `need` tiles from the ring, O(need)
  const need = targetSize - ringStart
  const ringSize = ringEnd - ringStart
  for (let i = 0; i < need; i++) {
    const j = i + Math.floor(Math.random() * (ringSize - i))
    const a = ringStart + i, b = ringStart + j
    const tmp = tiles[a]
    tiles[a] = tiles[b]
    tiles[b] = tmp
  }
  tiles.length = targetSize
}