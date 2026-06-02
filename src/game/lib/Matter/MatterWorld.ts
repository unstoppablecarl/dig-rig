import { random } from '../../helpers/random'
import { EMPTY, FIRE, MatterType, SAND, SETTLED_FLAG, TYPE_MASK, WATER } from './_Matter-types.ts'
import { MatterWorkerOutMsg } from './_MatterWorker-types.ts'
import { ELEMENT_ACTIONS } from './elements.ts'

const MAX_FLOW = 8

// Elements that can displace a settled liquid when they fall into it.
// Indexed by the MOVING element's base type.
const SINKS_THROUGH: Partial<Record<MatterType, MatterType[]>> = {
  [MatterType.SAND]: [MatterType.WATER, MatterType.OIL, MatterType.SALT_WATER, MatterType.ACID],
  [MatterType.SALT]: [MatterType.WATER, MatterType.SALT_WATER],
  [MatterType.ROCK]: [MatterType.WATER, MatterType.OIL, MatterType.SALT_WATER, MatterType.LAVA, MatterType.ACID],
  [MatterType.CONCRETE]: [MatterType.WATER, MatterType.SALT_WATER],
  [MatterType.THERMITE]: [MatterType.WATER, MatterType.SALT_WATER, MatterType.OIL],
  [MatterType.BURNING_THERMITE]: [MatterType.WATER, MatterType.SALT_WATER, MatterType.OIL],
}

// Elements whose settled state should also wake above-neighbours (liquids that
// might need to flow in when space opens — same idea as sand, but horizontal).
const LIQUID_TYPES = new Set<MatterType>([
  MatterType.WATER, MatterType.OIL, MatterType.SALT_WATER, MatterType.LAVA,
  MatterType.ACID, MatterType.NITRO,
])

export class MatterWorld {
  tiles!: Uint32Array
  dirtyChunks!: Uint8Array
  width = 0
  height = 0
  chunkSize = 0
  chunksWidth = 0
  activeSet = new Set<number>()

  private frame = 0
  ready = false

  // Owned by step(), valid only during a step() call
  justSettled: number[] = []
  leftFirst = false

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
    this.ready = true

    // 8ms so each tile's effective update rate stays ~60fps despite checkerboard halving
    setInterval(() => this.step(), 8)
  }

  activate(indices: number[]) {
    for (const idx of indices) {
      if (idx < 0 || idx >= this.tiles.length) continue
      const raw = this.tiles[idx]
      const t = raw & TYPE_MASK

      if (t === SAND) {
        // Clear any settled state and wake it
        this.tiles[idx] = SAND
        this.activeSet.add(idx)
      } else if (t === WATER) {
        this.tiles[idx] = WATER
        this.activeSet.add(idx)
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
        // All other active elements (FIRE, OIL, LAVA, STEAM, etc.)
        this.tiles[idx] = raw & ~SETTLED_FLAG
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
        if (raw & SETTLED_FLAG) {
          tiles[idx] = raw & ~SETTLED_FLAG
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
      if ((raw & SETTLED_FLAG) && LIQUID_TYPES.has((raw & TYPE_MASK) as MatterType)) {
        tiles[idx] = raw & ~SETTLED_FLAG
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
        if (!(raw & SETTLED_FLAG) || !LIQUID_TYPES.has((raw & TYPE_MASK) as MatterType)) break
        tiles[sidx] = raw & ~SETTLED_FLAG
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
    const toType = rawTo & TYPE_MASK

    // Sand/heavy particles sink through lighter liquids
    const sinksThrough = SINKS_THROUGH[tileType as MatterType]
    const canEnter = toType === EMPTY
      || (sinksThrough !== undefined && sinksThrough.includes(toType as MatterType))

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

  // Moves element upward — used by gases and steam.
  tryRise(
    fromIdx: number, fromTx: number, fromTy: number,
    next: Set<number>,
  ): boolean {
    const { width, tiles } = this
    if (fromTy === 0) {
      // Hit top — element disappears
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
      const toType = rawTo & TYPE_MASK
      if (toType !== EMPTY) continue

      tiles[toIdx] = tiles[fromIdx] & TYPE_MASK
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
   * Liquid density displacement — current element sinks into lighter liquid below or beside it,
   * and the lighter liquid rises to fill the gap. Mirrors project-sand doDensityLiquid.
   *
   * `lighter`         — element type that the current element is denser than
   * `sinkChance`      — 0-99: probability to try below-adjacent first
   * `equalizeChance`  — 0-99: probability to try horizontal equalization if sinking fails
   * `displacedAs`     — if provided, the displaced lighter element becomes this type instead
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
    const selfType = tiles[idx] & TYPE_MASK
    const leftFirst = this.leftFirst
    let targetIdx = -1

    if (random() < sinkChance && ty < height - 1) {
      const row = (ty + 1) * width
      if ((tiles[row + tx] & TYPE_MASK) === lighter) {
        targetIdx = row + tx
      } else {
        const dx1 = leftFirst ? -1 : 1
        const nx1 = tx + dx1, nx2 = tx - dx1
        if (nx1 >= 0 && nx1 < width && (tiles[row + nx1] & TYPE_MASK) === lighter)
          targetIdx = row + nx1
        else if (nx2 >= 0 && nx2 < width && (tiles[row + nx2] & TYPE_MASK) === lighter)
          targetIdx = row + nx2
      }
    }

    if (targetIdx === -1 && random() < equalizeChance) {
      const dx1 = leftFirst ? -1 : 1
      const nx1 = tx + dx1, nx2 = tx - dx1
      if (nx1 >= 0 && nx1 < width && (tiles[ty * width + nx1] & TYPE_MASK) === lighter)
        targetIdx = ty * width + nx1
      else if (nx2 >= 0 && nx2 < width && (tiles[ty * width + nx2] & TYPE_MASK) === lighter)
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
    // Wake any settled elements above idx that could now sink through the displaced lighter liquid
    this.reactivateAround(tx, ty, next)

    return true
  }

  /** True if `lighter` liquid exists anywhere below-adjacent (down, diag-left, diag-right). */
  hasDensityBelow(tx: number, ty: number, lighter: MatterType): boolean {
    if (ty >= this.height - 1) return false
    const { tiles, width } = this
    const row = (ty + 1) * width
    if ((tiles[row + tx] & TYPE_MASK) === lighter) return true
    if (tx > 0 && (tiles[row + tx - 1] & TYPE_MASK) === lighter) return true
    if (tx < width - 1 && (tiles[row + tx + 1] & TYPE_MASK) === lighter) return true
    return false
  }

  tryFlowHorizontal(
    fromIdx: number, fromTx: number, fromTy: number,
    dir: number,
    next: Set<number>,
  ): boolean {
    const { tiles, width, height } = this
    let dist = 0
    for (let d = 1; d <= MAX_FLOW; d++) {
      const nx = fromTx + dir * d
      if (nx < 0 || nx >= width) break
      if ((tiles[fromTy * width + nx] & TYPE_MASK) !== EMPTY) break
      dist = d
      if (fromTy + 1 < height && (tiles[(fromTy + 1) * width + nx] & TYPE_MASK) === EMPTY) break
    }
    if (dist === 0) return false
    return this.tryMove(fromIdx, fromTx, fromTy, fromTx + dir * dist, fromTy, tiles[fromIdx] & TYPE_MASK, next)
  }

  // ─── Higher-level helpers (mirrors project-sand World API) ────────────────

  /** Return linear index of the first neighbour of `type` (4-directional), or -1. */
  bordering(tx: number, ty: number, idx: number, type: MatterType): number {
    const { tiles, width, height } = this
    const down = ty < height - 1 ? idx + width : -1
    const left = tx > 0 ? idx - 1 : -1
    const right = tx < width - 1 ? idx + 1 : -1
    const up = ty > 0 ? idx - width : -1

    if (down !== -1 && (tiles[down] & TYPE_MASK) === type) return down
    if (left !== -1 && (tiles[left] & TYPE_MASK) === type) return left
    if (right !== -1 && (tiles[right] & TYPE_MASK) === type) return right
    if (up !== -1 && (tiles[up] & TYPE_MASK) === type) return up
    return -1
  }

  /** Return linear index of the first neighbour of `type` (8-directional), or -1. */
  borderingAdjacent(tx: number, ty: number, idx: number, type: MatterType): number {
    const { tiles, width, height } = this
    const atBottom = ty === height - 1
    const atTop = ty === 0

    if (!atBottom) {
      const b = idx + width
      if ((tiles[b] & TYPE_MASK) === type) return b
      if (tx > 0 && (tiles[b - 1] & TYPE_MASK) === type) return b - 1
      if (tx < width - 1 && (tiles[b + 1] & TYPE_MASK) === type) return b + 1
    }
    if (tx > 0 && (tiles[idx - 1] & TYPE_MASK) === type) return idx - 1
    if (tx < width - 1 && (tiles[idx + 1] & TYPE_MASK) === type) return idx + 1
    if (!atTop) {
      const a = idx - width
      if ((tiles[a] & TYPE_MASK) === type) return a
      if (tx > 0 && (tiles[a - 1] & TYPE_MASK) === type) return a - 1
      if (tx < width - 1 && (tiles[a + 1] & TYPE_MASK) === type) return a + 1
    }
    return -1
  }

  /** True if all 4 cardinal neighbours match `type`. */
  surroundedBy(tx: number, ty: number, idx: number, type: MatterType): boolean {
    const { tiles, width, height } = this
    if (ty < height - 1 && (tiles[idx + width] & TYPE_MASK) !== type) return false
    if (ty > 0 && (tiles[idx - width] & TYPE_MASK) !== type) return false
    if (tx > 0 && (tiles[idx - 1] & TYPE_MASK) !== type) return false
    if (tx < width - 1 && (tiles[idx + 1] & TYPE_MASK) !== type) return false
    return true
  }

  /** True if all 8 neighbours match `type`. */
  surroundedByAdjacent(tx: number, ty: number, idx: number, type: MatterType): boolean {
    const { tiles, width, height } = this
    const atBottom = ty === height - 1
    const atTop = ty === 0

    if (!atBottom) {
      const b = idx + width
      if ((tiles[b] & TYPE_MASK) !== type) return false
      if (tx > 0 && (tiles[b - 1] & TYPE_MASK) !== type) return false
      if (tx < width - 1 && (tiles[b + 1] & TYPE_MASK) !== type) return false
    }
    if (tx > 0 && (tiles[idx - 1] & TYPE_MASK) !== type) return false
    if (tx < width - 1 && (tiles[idx + 1] & TYPE_MASK) !== type) return false
    if (!atTop) {
      const a = idx - width
      if ((tiles[a] & TYPE_MASK) !== type) return false
      if (tx > 0 && (tiles[a - 1] & TYPE_MASK) !== type) return false
      if (tx < width - 1 && (tiles[a + 1] & TYPE_MASK) !== type) return false
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
    this.tiles[loc] = this.tiles[idx] & TYPE_MASK
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

  // ─── Main simulation loop ─────────────────────────────────────────────────

  step() {
    if (!this.ready) return
    if (this.activeSet.size === 0) return

    const phase = this.frame % 2
    this.frame++
    this.leftFirst = phase === 0
    const next = new Set<number>()
    this.justSettled = []

    for (const idx of this.activeSet) {
      const tx = idx % this.width
      const ty = idx / this.width | 0

      // Checkerboard: skip wrong-phase cells (defer to next step)
      if ((tx + ty) % 2 !== phase) {
        next.add(idx)
        continue
      }

      const raw = this.tiles[idx]
      const tile = (raw & TYPE_MASK) as MatterType

      ELEMENT_ACTIONS[tile]?.(this, tx, ty, idx, next)
    }

    this.activeSet = next
    if (this.justSettled.length > 0) {
      postMessage({ type: MatterWorkerOutMsg.SETTLED, indices: this.justSettled })
    }
  }
}


