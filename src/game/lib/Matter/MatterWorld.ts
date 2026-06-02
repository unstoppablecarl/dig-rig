import { EMPTY, MatterType, SAND, SAND_SETTLED, WATER } from './_Matter-types.ts'
import { MatterWorkerOutMsg } from './_MatterWorker-types.ts'

const MAX_FLOW = 8

export class MatterWorld {
  tiles!: Uint32Array
  dirtyChunks!: Uint8Array
  width = 0
  height = 0
  chunkSize = 0
  chunksWidth = 0
  activeSet = new Set<number>()

  readonly stableWater = new Set<number>()

  private frame = 0
  ready = false

  // Owned by step(), valid only during a step() call
  justSettled: number[] = []
  leftFirst = false

  maxXIdx: number
  maxYIdx: number
  maxIdx: number

  init(tilesBuffer: SharedArrayBuffer, dirtyChunksBuffer: SharedArrayBuffer, width: number, height: number, chunkSize: number) {
    this.tiles = new Uint32Array(tilesBuffer)
    this.dirtyChunks = new Uint8Array(dirtyChunksBuffer)
    this.width = width
    this.height = height
    this.chunkSize = chunkSize
    this.chunksWidth = Math.ceil(width / chunkSize)
    this.ready = true

    // 8ms so each tile's effective update rate stays ~60fps despite checkerboard halving
    setInterval(() => this.step(), 8)
  }

  activate(indices: number[]) {
    for (const idx of indices) {
      if (idx < 0 || idx >= this.tiles.length) continue
      const t = this.tiles[idx]
      if (t === SAND || t === SAND_SETTLED) {
        this.tiles[idx] = SAND
        this.activeSet.add(idx)
      } else if (t === WATER) {
        this.stableWater.delete(idx)
        this.activeSet.add(idx)
      }
    }
  }

  check(tx: number, ty: number) {
    this.reactivateAround(tx, ty, this.activeSet)
  }

  markDirty(tx: number, ty: number) {
    this.dirtyChunks[(ty / this.chunkSize | 0) * this.chunksWidth + (tx / this.chunkSize | 0)] = 1
  }

  // Re-activate settled material that could flow into (tx, ty) now that it's empty.
  // dest is this.next (inside step) or this.activeSet (from message handlers).
  reactivateAround(tx: number, ty: number, dest: Set<number>) {
    const { tiles, width, stableWater } = this
    const aboveY = ty - 1
    if (aboveY >= 0) {
      for (let dx = -1; dx <= 1; dx++) {
        const ax = tx + dx
        if (ax < 0 || ax >= width) continue
        const idx = aboveY * width + ax
        if (tiles[idx] === SAND_SETTLED) {
          tiles[idx] = SAND
          this.markDirty(ax, aboveY)
          dest.add(idx)
        }
      }
    }

    // Stable water above (diagonal and straight) that could fall into (tx, ty)
    const aboveChecks: [number, number][] = [[tx, ty - 1], [tx - 1, ty - 1], [tx + 1, ty - 1]]
    for (const [ax, ay] of aboveChecks) {
      if (ax < 0 || ax >= width || ay < 0) continue
      const idx = ay * width + ax
      if (stableWater.has(idx)) {
        stableWater.delete(idx)
        dest.add(idx)
      }
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

  tryMove(
    fromIdx: number, fromTx: number, fromTy: number,
    toTx: number, toTy: number,
    tileType: number,
    next: Set<number>,
  ): boolean {
    const { width, height, tiles } = this
    if (toTx < 0 || toTx >= width || toTy < 0 || toTy >= height) return false
    const toIdx = toTy * width + toTx
    const toTile = tiles[toIdx]

    // Sand sinks through water (density swap); everything else requires an empty destination
    const canEnter = toTile === EMPTY || ((tileType === SAND) && toTile === WATER)
    if (!canEnter) return false

    tiles[toIdx] = tileType
    tiles[fromIdx] = toTile  // displaced tile (EMPTY or WATER) rises to source position

    this.markDirty(fromTx, fromTy)
    this.markDirty(toTx, toTy)
    next.add(toIdx)

    if (toTile === WATER) {
      this.stableWater.delete(toIdx)  // toIdx is no longer water
      next.add(fromIdx)           // displaced water at fromIdx needs to re-flow
      // Don't reactivateAround — fromIdx now holds WATER, not EMPTY,
      // so there's no new gap for settled material to flow into.
    } else {
      this.reactivateAround(fromTx, fromTy, next)
    }

    return true
  }

  tryFlowHorizontal(fromIdx: number, fromTx: number, fromTy: number, dir: number, next: Set<number>): boolean {
    const { tiles, width, height } = this
    let dist = 0
    for (let d = 1; d <= MAX_FLOW; d++) {
      const nx = fromTx + dir * d
      if (nx < 0 || nx >= width) break
      if (tiles[fromTy * width + nx] !== EMPTY) break
      dist = d
      if (fromTy + 1 < height && tiles[(fromTy + 1) * width + nx] === EMPTY) break
    }
    if (dist === 0) return false
    return this.tryMove(fromIdx, fromTx, fromTy, fromTx + dir * dist, fromTy, WATER, next)
  }

  step() {
    if (!this.ready) return
    if (this.activeSet.size === 0) return

    const phase = this.frame % 2
    this.frame++
    // Alternate diagonal/horizontal preference each frame to avoid directional bias
    this.leftFirst = phase === 0
    const next = new Set<number>()
    this.justSettled = []

    for (const idx of this.activeSet) {
      const tx = idx % this.width
      const ty = idx / this.width | 0

      // Checkerboard: only process cells whose (tx+ty) parity matches this frame's phase.
      // Cells in the wrong phase are deferred to next step — this removes the need to sort
      // by row (a tile can't be moved twice in one step since its destination is the opposite parity).
      if ((tx + ty) % 2 !== phase) {
        next.add(idx)
        continue
      }

      const tile = this.tiles[idx] as MatterType

      const leftFirst = this.leftFirst
      if (tile === SAND) {
        const moved =
          this.tryMove(idx, tx, ty, tx, ty + 1, SAND, next) ||
          this.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, SAND, next) ||
          this.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, SAND, next)

        if (!moved) {
          this.tiles[idx] = SAND_SETTLED
          this.markDirty(tx, ty)
          this.justSettled.push(idx)
        }

      } else if (tile === WATER) {
        const moved =
          this.tryMove(idx, tx, ty, tx, ty + 1, WATER, next) ||
          this.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, WATER, next) ||
          this.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, WATER, next) ||
          this.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
          this.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

        if (!moved) {
          this.stableWater.add(idx)
          // Wake SAND_SETTLED directly above — it should sink through water
          if (ty > 0) {
            const aboveIdx = (ty - 1) * this.width + tx
            if (this.tiles[aboveIdx] === SAND_SETTLED) {
              this.tiles[aboveIdx] = SAND
              this.markDirty(tx, ty - 1)
              next.add(aboveIdx)
            }
          }
        }
      }
    }

    this.activeSet = next
    if (this.justSettled.length > 0) {
      postMessage({ type: MatterWorkerOutMsg.SETTLED, indices: this.justSettled })
    }
  }
}
