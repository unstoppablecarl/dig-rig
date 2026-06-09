import { random } from '../../helpers/random'
import { LIQUID_TYPES, SINKS_THROUGH } from './_Matter-meta'
import {
  EMPTY,
  FIRE,
  isSettled,
  MatterType,
  matterType,
  MatterTypeSet,
  SAND,
  setSettled,
  WATER,
} from './_Matter-types.ts'
import { MATTER_ACTIONS } from './matter.ts'

const MAX_FLOW = 8

export class MatterSim {
  tiles!: Uint32Array
  dirtyChunks!: Uint8Array
  width = 0
  height = 0
  chunkSize = 0
  chunksWidth = 0

  // Set externally by coordinator/pool before processSubset
  frame = 0
  leftFirst = false
  justSettled: number[] = []

  init(
    tilesBuffer: SharedArrayBuffer,
    dirtyChunksBuffer: SharedArrayBuffer,
    width: number,
    height: number,
    chunkSize: number,
  ) {
    this.tiles = new Uint32Array(tilesBuffer)
    this.dirtyChunks = new Uint8Array(dirtyChunksBuffer)
    this.width = width
    this.height = height
    this.chunkSize = chunkSize
    this.chunksWidth = Math.ceil(width / chunkSize)
  }

  // Wakes tiles in `target`. Called by coordinator on ACTIVATE messages.
  activate(indices: number[], target: Set<number>) {
    for (const idx of indices) {
      if (idx < 0 || idx >= this.tiles.length) continue
      const raw = this.tiles[idx]
      const t = matterType(raw)

      if (t === SAND) {
        this.tiles[idx] = SAND
        target.add(idx)
      } else if (t === WATER) {
        this.tiles[idx] = WATER
        target.add(idx)
      } else if (
        t !== EMPTY &&
        t !== MatterType.SOLID &&
        t !== MatterType.PERMANENT &&
        t !== MatterType.WAX &&
        t !== MatterType.FUSE &&
        t !== MatterType.ICE &&
        t !== MatterType.CHILLED_ICE &&
        t !== MatterType.PLANT
      ) {
        this.tiles[idx] = setSettled(raw, false)
        target.add(idx)
      }
    }
  }

  // Runs matterType actions for the given tile indices. Pool workers call this
  // once per round with their assigned subset of the active set.
  processSubset(indices: number[], next: Set<number>) {
    const phase = this.frame % 2
    for (const idx of indices) {
      const tx = idx % this.width
      const ty = idx / this.width | 0

      // Per-cell checkerboard: defer wrong-phase cells to next step to prevent
      // double-processing when an matterType moves into a neighbour's position.
      if ((tx + ty) % 2 !== phase) {
        next.add(idx)
        continue
      }

      const raw = this.tiles[idx]
      const tile = matterType(raw)
      MATTER_ACTIONS[tile]?.(this, tx, ty, idx, next)
    }
  }

  markDirty(tx: number, ty: number) {
    this.dirtyChunks[(ty / this.chunkSize | 0) * this.chunksWidth + (tx / this.chunkSize | 0)] = 1
  }

  // Re-activate settled material that could flow into (tx, ty) now that it is empty.
  // dest is `next` (inside step) or this.activeSet (from message handlers).
  reactivateAround(tx: number, ty: number, dest: Set<number>) {
    const { tiles, width } = this

    // Wake any settled tile in the 3-wide strip directly above
    const aboveY = ty - 1
    if (aboveY >= 0) {
      for (let dx = -1; dx <= 1; dx++) {
        const ax = tx + dx
        if (ax < 0 || ax >= width) continue
        const idx = aboveY * width + ax
        const raw = tiles[idx]
        if (isSettled(raw)) {
          tiles[idx] = setSettled(raw, false)
          this.markDirty(ax, aboveY)
          dest.add(idx)
        }
      }
    }

    // Wake settled liquids above (diagonal + straight) that could fall into this cell
    const aboveChecks: [number, number][] = [
      [tx, ty - 1], [tx - 1, ty - 1], [tx + 1, ty - 1],
    ]
    for (const [ax, ay] of aboveChecks) {
      if (ax < 0 || ax >= width || ay < 0) continue
      const idx = ay * width + ax
      const raw = tiles[idx]
      if (isSettled(raw) && LIQUID_TYPES.has(matterType(raw))) {
        tiles[idx] = setSettled(raw, false)
        dest.add(idx)
      }
    }

    // Wake the horizontal chain of settled liquids so pools level quickly
    for (const dir of [-1, 1]) {
      for (let d = 1; d <= MAX_FLOW; d++) {
        const ax = tx + dir * d
        if (ax < 0 || ax >= width) break
        const sidx = ty * width + ax
        const raw = tiles[sidx]
        if (!isSettled(raw) || !LIQUID_TYPES.has(matterType(raw))) break
        tiles[sidx] = setSettled(raw, false)
        dest.add(sidx)
      }
    }
  }

  // ─── Movement primitives ──────────────────────────────────────────────────

  tryMove(
    fromIdx: number, fromTx: number, fromTy: number,
    toTx: number, toTy: number,
    tileType: number,
    next: Set<number>,
  ): boolean {
    const { width, height, tiles } = this
    if (toTx < 0 || toTx >= width || toTy < 0 || toTy >= height) return false
    const toIdx = toTy * width + toTx
    const rawTo = tiles[toIdx]
    const toType = matterType(rawTo)

    // Sand/heavy particles sink through lighter liquids
    const sinksThrough = SINKS_THROUGH[tileType as MatterType]
    const canEnter = toType === EMPTY
      || (sinksThrough !== undefined && sinksThrough.has(toType))

    if (!canEnter) return false

    tiles[toIdx] = tileType
    // Displaced material (liquid or empty) rises back — strip its settled flag
    tiles[fromIdx] = toType === EMPTY ? EMPTY : (toType as number)
    this.markDirty(fromTx, fromTy)
    this.markDirty(toTx, toTy)
    next.add(toIdx)

    if (toType !== EMPTY) {
      // Displaced liquid now at fromIdx needs to re-flow
      next.add(fromIdx)
    } else {
      this.reactivateAround(fromTx, fromTy, next)
    }

    return true
  }

  // Moves matterType upward — used by gases and steam.
  tryRise(
    fromIdx: number, fromTx: number, fromTy: number,
    next: Set<number>,
  ): boolean {
    const { width, tiles } = this
    if (fromTy === 0) {
      // Hit top — matterType disappears
      tiles[fromIdx] = EMPTY
      this.markDirty(fromTx, fromTy)
      return true
    }

    const leftFirst = this.leftFirst
    const dirs = leftFirst ? [-1, 0, 1] : [1, 0, -1]

    for (const dx of dirs) {
      const tx = fromTx + dx
      const ty = fromTy - 1
      if (tx < 0 || tx >= width) continue
      const toIdx = ty * width + tx
      const rawTo = tiles[toIdx]
      const toType = matterType(rawTo)
      if (toType !== EMPTY) continue

      tiles[toIdx] = matterType(tiles[fromIdx])
      tiles[fromIdx] = EMPTY
      this.markDirty(fromTx, fromTy)
      this.markDirty(tx, ty)
      next.add(toIdx)
      this.reactivateAround(fromTx, fromTy, next)
      return true
    }
    return false
  }

  /**
   * Liquid density displacement — current matterType sinks into lighter liquid below or beside it,
   * and the lighter liquid rises to fill the gap. Mirrors project-sand doDensityLiquid.
   *
   * `lighter`         — matterType type that the current matterType is denser than
   * `sinkChance`      — 0-99: probability to try below-adjacent first
   * `equalizeChance`  — 0-99: probability to try horizontal equalization if sinking fails
   * `displacedAs`     — if provided, the displaced lighter matterType becomes this type instead
   *                     (used by cryo to freeze displaced water into CHILLED_ICE)
   */
  doDensityLiquid(
    tx: number, ty: number, idx: number, next: Set<number>,
    lighter: MatterType,
    sinkChance: number,
    equalizeChance: number,
    displacedAs?: number,
  ): boolean {
    const { tiles, width, height } = this
    const selfType = matterType(tiles[idx])
    const leftFirst = this.leftFirst
    let targetIdx = -1

    if (random() < sinkChance && ty < height - 1) {
      const row = (ty + 1) * width
      if (matterType(tiles[row + tx]) === lighter) {
        targetIdx = row + tx
      } else {
        const dx1 = leftFirst ? -1 : 1
        const nx1 = tx + dx1, nx2 = tx - dx1
        if (nx1 >= 0 && nx1 < width && matterType(tiles[row + nx1]) === lighter)
          targetIdx = row + nx1
        else if (nx2 >= 0 && nx2 < width && matterType(tiles[row + nx2]) === lighter)
          targetIdx = row + nx2
      }
    }

    if (targetIdx === -1 && random() < equalizeChance) {
      const dx1 = leftFirst ? -1 : 1
      const nx1 = tx + dx1, nx2 = tx - dx1
      if (nx1 >= 0 && nx1 < width && matterType(tiles[ty * width + nx1]) === lighter)
        targetIdx = ty * width + nx1
      else if (nx2 >= 0 && nx2 < width && matterType(tiles[ty * width + nx2]) === lighter)
        targetIdx = ty * width + nx2
    }

    if (targetIdx === -1) return false

    tiles[targetIdx] = selfType
    tiles[idx] = displacedAs !== undefined ? displacedAs : lighter

    const tx2 = targetIdx % width
    const ty2 = (targetIdx / width) | 0
    this.markDirty(tx, ty)
    this.markDirty(tx2, ty2)
    next.add(targetIdx)

    if (displacedAs === undefined) next.add(idx)
    // Wake any settled defs above idx that could now sink through the displaced lighter liquid
    this.reactivateAround(tx, ty, next)

    return true
  }

  /** True if `lighter` liquid exists anywhere below-adjacent (down, diag-left, diag-right). */
  hasDensityBelow(tx: number, ty: number, lighter: MatterType): boolean {
    if (ty >= this.height - 1) return false
    const { tiles, width } = this
    const row = (ty + 1) * width
    if (matterType(tiles[row + tx]) === lighter) return true
    if (tx > 0 && matterType(tiles[row + tx - 1]) === lighter) return true
    if (tx < width - 1 && matterType(tiles[row + tx + 1]) === lighter) return true
    return false
  }

  tryFlowHorizontal(
    fromIdx: number, fromTx: number, fromTy: number,
    dir: -1 | 1,
    next: Set<number>,
  ): boolean {
    const { tiles, width, height } = this
    let dist = 0
    for (let d = 1; d <= MAX_FLOW; d++) {
      const nx = fromTx + dir * d
      if (nx < 0 || nx >= width) break
      if (matterType(tiles[fromTy * width + nx]) !== EMPTY) break
      dist = d
      if (fromTy + 1 < height && matterType(tiles[(fromTy + 1) * width + nx]) === EMPTY) break
    }
    if (dist === 0) return false
    return this.tryMove(fromIdx, fromTx, fromTy, fromTx + dir * dist, fromTy, matterType(tiles[fromIdx]), next)
  }

  // ─── Higher-level helpers (mirrors project-sand World API) ────────────────

  /** Clear SETTLED_FLAG on all 4-directional neighbours whose base type matches `type`. */
  wakeSettledNeighbors(tx: number, ty: number, idx: number, type: MatterType, dest: Set<number>) {
    const { tiles, width, height } = this
    for (const nidx of [
      ty > 0 ? idx - width : -1,
      ty < height - 1 ? idx + width : -1,
      tx > 0 ? idx - 1 : -1,
      tx < width - 1 ? idx + 1 : -1,
    ]) {
      if (nidx === -1) continue
      const raw = tiles[nidx]
      if (matterType(raw) === type && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirty(nidx % width, nidx / width | 0)
        dest.add(nidx)
      }
    }
  }

  /** Return linear index of the first neighbour of `type` (4-directional), or -1. */
  bordering(tx: number, ty: number, idx: number, type: MatterType): number {
    const { tiles, width, height } = this
    const down = ty < height - 1 ? idx + width : -1
    const left = tx > 0 ? idx - 1 : -1
    const right = tx < width - 1 ? idx + 1 : -1
    const up = ty > 0 ? idx - width : -1

    if (down !== -1 && matterType(tiles[down]) === type) return down
    if (left !== -1 && matterType(tiles[left]) === type) return left
    if (right !== -1 && matterType(tiles[right]) === type) return right
    if (up !== -1 && matterType(tiles[up]) === type) return up
    return -1
  }

  /** Return linear index of the first neighbour of `type` (8-directional), or -1. */
  borderingAdjacent(tx: number, ty: number, idx: number, type: MatterType): number {
    const { tiles, width, height } = this
    const atBottom = ty === height - 1
    const atTop = ty === 0

    if (!atBottom) {
      const b = idx + width
      if (matterType(tiles[b]) === type) return b
      if (tx > 0 && matterType(tiles[b - 1]) === type) return b - 1
      if (tx < width - 1 && matterType(tiles[b + 1]) === type) return b + 1
    }
    if (tx > 0 && matterType(tiles[idx - 1]) === type) return idx - 1
    if (tx < width - 1 && matterType(tiles[idx + 1]) === type) return idx + 1
    if (!atTop) {
      const a = idx - width
      if (matterType(tiles[a]) === type) return a
      if (tx > 0 && matterType(tiles[a - 1]) === type) return a - 1
      if (tx < width - 1 && matterType(tiles[a + 1]) === type) return a + 1
    }
    return -1
  }

  /** True if all 4 cardinal neighbours match `type`. */
  surroundedBy(tx: number, ty: number, idx: number, type: MatterType): boolean {
    const { tiles, width, height } = this
    if (ty < height - 1 && matterType(tiles[idx + width]) !== type) return false
    if (ty > 0 && matterType(tiles[idx - width]) !== type) return false
    if (tx > 0 && matterType(tiles[idx - 1]) !== type) return false
    if (tx < width - 1 && matterType(tiles[idx + 1]) !== type) return false
    return true
  }

  /** True if all 4 cardinal neighbours are in the MatterTypeSet. */
  surroundedByMask(tx: number, ty: number, idx: number, mask: MatterTypeSet): boolean {
    const { tiles, width, height } = this
    if (ty < height - 1 && !mask.has(matterType(tiles[idx + width]))) return false
    if (ty > 0 && !mask.has(matterType(tiles[idx - width]))) return false
    if (tx > 0 && !mask.has(matterType(tiles[idx - 1]))) return false
    if (tx < width - 1 && !mask.has(matterType(tiles[idx + 1]))) return false
    return true
  }

  /** True if all 8 neighbours match `type`. */
  surroundedByAdjacent(tx: number, ty: number, idx: number, type: MatterType): boolean {
    const { tiles, width, height } = this
    const atBottom = ty === height - 1
    const atTop = ty === 0

    if (!atBottom) {
      const b = idx + width
      if (matterType(tiles[b]) !== type) return false
      if (tx > 0 && matterType(tiles[b - 1]) !== type) return false
      if (tx < width - 1 && matterType(tiles[b + 1]) !== type) return false
    }
    if (tx > 0 && matterType(tiles[idx - 1]) !== type) return false
    if (tx < width - 1 && matterType(tiles[idx + 1]) !== type) return false
    if (!atTop) {
      const a = idx - width
      if (matterType(tiles[a]) !== type) return false
      if (tx > 0 && matterType(tiles[a - 1]) !== type) return false
      if (tx < width - 1 && matterType(tiles[a + 1]) !== type) return false
    }
    return true
  }

  /**
   * Transform self when touching `touchType`. `chance` is 0–99.
   * Returns true if the transform occurred.
   */
  doTransform(
    tx: number, ty: number, idx: number, next: Set<number>,
    touchType: MatterType, intoType: MatterType, chance: number,
  ): boolean {
    if (random() >= chance) return false
    if (this.bordering(tx, ty, idx, touchType) === -1) return false
    this.tiles[idx] = intoType
    this.markDirty(tx, ty)
    next.add(idx)
    return true
  }

  /**
   * Spread self into an adjacent tile of `intoType`. `chance` is 0–99.
   */
  doGrow(
    tx: number, ty: number, idx: number, next: Set<number>,
    intoType: MatterType, chance: number,
  ): boolean {
    if (random() >= chance) return false
    const loc = this.borderingAdjacent(tx, ty, idx, intoType)
    if (loc === -1) return false
    this.tiles[loc] = matterType(this.tiles[idx])
    const lx = loc % this.width
    const ly = loc / this.width | 0
    this.markDirty(lx, ly)
    next.add(loc)
    return true
  }

  /**
   * Set all 4 cardinal neighbours to FIRE and self to FIRE.
   */
  doBorderBurn(tx: number, ty: number, idx: number, next: Set<number>) {
    const { tiles, width, height } = this
    const neighbors: [number, number, number][] = [
      [tx, ty - 1, idx - width],
      [tx, ty + 1, idx + width],
      [tx - 1, ty, idx - 1],
      [tx + 1, ty, idx + 1],
    ]
    for (const [nx, ny, nidx] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      tiles[nidx] = FIRE
      this.markDirty(nx, ny)
      next.add(nidx)
    }
    tiles[idx] = FIRE
    this.markDirty(tx, ty)
    next.add(idx)
  }
}
