/// <reference lib="webworker" />

import { TerrainType } from '../Tilemap/_Tilemap-types.ts'

const EMPTY = TerrainType.EMPTY
const SAND = TerrainType.SAND
const SAND_SETTLED = TerrainType.SAND_SETTLED
const WATER = TerrainType.WATER

let tiles: Uint8Array
let dirty: Uint8Array
let width = 0
let height = 0
let chunkSize = 0
let chunksWidth = 0
let activeSet = new Set<number>()
const stableWater = new Set<number>()
let frame = 0
let ready = false

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data

  if (type === 'init') {
    tiles = new Uint8Array(e.data.tilesBuffer as SharedArrayBuffer)
    dirty = new Uint8Array(e.data.dirtyBuffer as SharedArrayBuffer)
    width = e.data.width as number
    height = e.data.height as number
    chunkSize = e.data.chunkSize as number
    chunksWidth = Math.ceil(width / chunkSize)
    ready = true
    // 8ms so each tile's effective update rate stays ~60fps despite checkerboard halving
    setInterval(step, 8)
    return
  }

  if (type === 'activate') {
    for (const idx of e.data.indices as number[]) {
      if (idx < 0 || idx >= tiles.length) continue
      const t = tiles[idx]
      if (t === SAND || t === SAND_SETTLED) {
        tiles[idx] = SAND
        activeSet.add(idx)
      } else if (t === WATER) {
        stableWater.delete(idx)
        activeSet.add(idx)
      }
    }
    return
  }

  if (type === 'check') {
    reactivateAround(e.data.tx as number, e.data.ty as number, activeSet)
  }
}

function markDirty(tx: number, ty: number) {
  dirty[(ty / chunkSize | 0) * chunksWidth + (tx / chunkSize | 0)] = 1
}

// Re-activate settled material that could flow into the tile at (tx, ty) now that it's empty.
// dest is next (inside step) or activeSet (from message handlers).
function reactivateAround(tx: number, ty: number, dest: Set<number>) {
  // SAND_SETTLED directly above or diagonally above
  const aboveY = ty - 1
  if (aboveY >= 0) {
    for (let dx = -1; dx <= 1; dx++) {
      const ax = tx + dx
      if (ax < 0 || ax >= width) continue
      const idx = aboveY * width + ax
      if (tiles[idx] === SAND_SETTLED) {
        tiles[idx] = SAND
        markDirty(ax, aboveY)
        dest.add(idx)
      }
    }
  }

  // Stable water above (diagonal and straight) that could fall into (tx, ty)
  const aboveChecks: [number, number][] = [[tx, ty - 1], [tx - 1, ty - 1], [tx + 1, ty - 1]]
  for (const [ax, ay] of aboveChecks) {
    if (ax < 0 || ax >= width || ay < 0) continue
    const idx = ay * width + ax
    if (stableWater.has(idx)) { stableWater.delete(idx); dest.add(idx) }
  }

  // Wake the full consecutive chain of stable water in each direction so the pool
  // levels quickly when space opens up.
  for (const dir of [-1, 1]) {
    for (let d = 1; d <= MAX_FLOW; d++) {
      const ax = tx + dir * d
      if (ax < 0 || ax >= width) break
      const sidx = ty * width + ax
      if (!stableWater.has(sidx)) break
      stableWater.delete(sidx)
      dest.add(sidx)
    }
  }
}

function tryMove(
  fromIdx: number, fromTx: number, fromTy: number,
  toTx: number, toTy: number,
  tileType: number,
  next: Set<number>,
): boolean {
  if (toTx < 0 || toTx >= width || toTy < 0 || toTy >= height) return false
  const toIdx = toTy * width + toTx
  const toTile = tiles[toIdx]

  // Sand sinks through water (density swap); everything else requires an empty destination
  const canEnter = toTile === EMPTY || (tileType === SAND && toTile === WATER)
  if (!canEnter) return false

  tiles[toIdx] = tileType
  tiles[fromIdx] = toTile  // displaced tile (EMPTY or WATER) rises to source position

  markDirty(fromTx, fromTy)
  markDirty(toTx, toTy)
  next.add(toIdx)

  if (toTile === WATER) {
    stableWater.delete(toIdx)  // toIdx is no longer water
    next.add(fromIdx)           // displaced water at fromIdx needs to re-flow
    // Don't reactivateAround — fromIdx now holds WATER, not EMPTY,
    // so there's no new gap for settled material to flow into.
  } else {
    reactivateAround(fromTx, fromTy, next)
  }

  return true
}

const MAX_FLOW = 8
function tryFlowHorizontal(
  fromIdx: number, fromTx: number, fromTy: number,
  dir: number,
  next: Set<number>,
): boolean {
  let dist = 0
  for (let d = 1; d <= MAX_FLOW; d++) {
    const nx = fromTx + dir * d
    if (nx < 0 || nx >= width) break
    if (tiles[fromTy * width + nx] !== EMPTY) break
    dist = d
    if (tiles[(fromTy + 1) * width + nx] === EMPTY) break
  }
  if (dist === 0) return false
  return tryMove(fromIdx, fromTx, fromTy, fromTx + dir * dist, fromTy, WATER, next)
}

function step() {
  if (!ready || activeSet.size === 0) return

  const phase = frame % 2
  frame++
  // Alternate diagonal/horizontal preference each frame to avoid directional bias
  const leftFirst = phase === 0

  const next = new Set<number>()
  const justSettled: number[] = []

  for (const idx of activeSet) {
    const tx = idx % width
    const ty = idx / width | 0

    // Checkerboard: only process cells whose (tx+ty) parity matches this frame's phase.
    // Cells in the wrong phase are deferred to next step — this removes the need to sort
    // by row (a tile can't be moved twice in one step since its destination is the opposite parity).
    if ((tx + ty) % 2 !== phase) {
      next.add(idx)
      continue
    }

    const tile = tiles[idx]

    if (tile === SAND) {
      const moved =
        tryMove(idx, tx, ty, tx, ty + 1, SAND, next) ||
        tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, SAND, next) ||
        tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, SAND, next)

      if (!moved) {
        tiles[idx] = SAND_SETTLED
        markDirty(tx, ty)
        justSettled.push(idx)
      }

    } else if (tile === WATER) {
      const moved =
        tryMove(idx, tx, ty, tx, ty + 1, WATER, next) ||
        tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, WATER, next) ||
        tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, WATER, next) ||
        tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
        tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

      if (!moved) {
        stableWater.add(idx)
        // don't carry forward — water waits until a neighbour opens up
      }

    }
    // tile was overwritten by the main thread — drop it from the active set
  }

  activeSet = next

  if (justSettled.length > 0) {
    self.postMessage({ type: 'settled', indices: justSettled })
  }
}
