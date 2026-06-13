import { random } from '../../helpers/random'
import { isSolid, isStructural, LIQUID_TYPES, SINKS_THROUGH } from './_Matter-meta'
import {
  EMPTY,
  FIRE,
  getOwner,
  isAnchored,
  isSettled,
  MatterType,
  matterType,
  MatterTypeSet,
  setOwner,
  setSettled,
} from './_Matter.types.ts'
import { MATTER_ACTIONS } from './matter.ts'
import type { MatterTankId } from './MatterTank/_MatterTank.types.ts'

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
  next = new Set<number>()

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

      if (
        t === EMPTY ||
        t === MatterType.SOLID ||
        t === MatterType.PERMANENT ||
        t === MatterType.WAX ||
        t === MatterType.FUSE ||
        t === MatterType.ICE ||
        t === MatterType.CHILLED_ICE ||
        t === MatterType.PLANT ||
        isAnchored(raw) ||
        isStructural(raw)
      ) continue

      this.tiles[idx] = setSettled(raw, false)
      this.markDirty(idx % this.width, idx / this.width | 0)
      target.add(idx)
    }
  }

  // Runs matterType actions for the given tile indices. Pool workers call this
  // once per round with their assigned subset of the active set.
  processSubset(indices: number[]) {
    const phase = this.frame % 2
    for (const idx of indices) {
      const tx = idx % this.width
      const ty = idx / this.width | 0

      // Per-cell checkerboard: defer wrong-phase cells to next step to prevent
      // double-processing when an matterType moves into a neighbour's position.
      if ((tx + ty) % 2 !== phase) {
        this.next.add(idx)
        continue
      }

      const raw = this.tiles[idx]
      const tile = matterType(raw)
      MATTER_ACTIONS[tile]?.(this, tx, ty, idx)
    }
  }

  markDirty(tx: number, ty: number) {
    this.dirtyChunks[(ty / this.chunkSize | 0) * this.chunksWidth + (tx / this.chunkSize | 0)] = 1
  }

  // Re-activate settled material that could flow into (tx, ty) now that it is empty.
  // When called outside a step (from message handlers), pass an explicit dest set.
  reactivateAround(tx: number, ty: number, dest: Set<number> = this.next) {
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
  ): boolean {
    const { width, height, tiles } = this
    if (toTx < 0 || toTx >= width || toTy < 0 || toTy >= height) return false
    const toIdx = toTy * width + toTx
    const rawFrom = tiles[fromIdx]
    const fromType = matterType(rawFrom)
    const rawTo = tiles[toIdx]
    const toType = matterType(rawTo)

    // Sand/heavy particles sink through lighter liquids
    const sinksThrough = SINKS_THROUGH[fromType]
    const canEnter = toType === EMPTY
      || (sinksThrough !== undefined && sinksThrough.has(toType))

    if (!canEnter) return false

    // Write full raw value (owner bits intact), settled flag cleared
    tiles[toIdx] = setSettled(rawFrom, false)
    tiles[fromIdx] = toType === EMPTY ? EMPTY : setSettled(rawTo, false)
    this.markDirty(fromTx, fromTy)
    this.markDirty(toTx, toTy)
    this.next.add(toIdx)

    if (toType !== EMPTY) {
      // Displaced liquid now at fromIdx needs to re-flow
      this.next.add(fromIdx)
    } else {
      this.reactivateAround(fromTx, fromTy)
    }

    return true
  }

  // Moves matterType upward — used by gases and steam.
  tryRise(
    fromIdx: number, fromTx: number, fromTy: number,
  ): boolean {
    const { width, tiles } = this
    const leftFirst = this.leftFirst
    const dirs = leftFirst ? [-1, 0, 1] : [1, 0, -1]

    for (const dx of dirs) {
      const tx = fromTx + dx
      const ty = fromTy - 1
      if (tx < 0 || tx >= width || ty < 0) continue
      const toIdx = ty * width + tx
      const rawTo = tiles[toIdx]
      const toType = matterType(rawTo)
      if (toType !== EMPTY) continue

      tiles[toIdx] = tiles[fromIdx]
      tiles[fromIdx] = EMPTY
      this.markDirty(fromTx, fromTy)
      this.markDirty(tx, ty)
      this.next.add(toIdx)
      this.reactivateAround(fromTx, fromTy)
      return true
    }
    return false
  }

  /**
   * Liquid density displacement — current matterType sinks into lighter liquid below or beside it,
   * and the lighter liquid rises to fill the gap.
   *
   * `lighter`         — matterType type that the current matterType is denser than
   * `sinkChance`      — 0-99: probability to try below-adjacent first
   * `equalizeChance`  — 0-99: probability to try horizontal equalization if sinking fails
   * `displacedAs`     — if provided, the displaced lighter matterType becomes this type instead
   *                     (used by cryo to freeze displaced water into CHILLED_ICE)
   */
  doDensityLiquid(
    tx: number, ty: number, idx: number,
    lighter: MatterType,
    sinkChance: number,
    equalizeChance: number,
    displacedAs?: number,
  ): boolean {
    const { tiles, width, height } = this
    const selfRaw = tiles[idx]
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

    tiles[targetIdx] = selfRaw
    tiles[idx] = displacedAs !== undefined ? displacedAs : lighter

    const tx2 = targetIdx % width
    const ty2 = (targetIdx / width) | 0
    this.markDirty(tx, ty)
    this.markDirty(tx2, ty2)
    this.next.add(targetIdx)

    if (displacedAs === undefined) this.next.add(idx)
    // Wake any settled tiles above idx that could now sink through the displaced lighter liquid
    this.reactivateAround(tx, ty)

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
    return this.tryMove(fromIdx, fromTx, fromTy, fromTx + dir * dist, fromTy)
  }

  // ─── Higher-level helpers (mirrors project-sand World API) ────────────────

  /** Clear SETTLED_FLAG on all 4-directional neighbours whose base type matches `type`. */
  wakeSettledNeighbors(tx: number, ty: number, idx: number, type: MatterType) {
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
        this.next.add(nidx)
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

  borderingAny(tx: number, ty: number, idx: number, mask: MatterTypeSet): number {
    const { tiles, width, height } = this
    const down = ty < height - 1 ? idx + width : -1
    const left = tx > 0 ? idx - 1 : -1
    const right = tx < width - 1 ? idx + 1 : -1
    const up = ty > 0 ? idx - width : -1

    if (down !== -1 && mask.has(matterType(tiles[down]))) return down
    if (left !== -1 && mask.has(matterType(tiles[left]))) return left
    if (right !== -1 && mask.has(matterType(tiles[right]))) return right
    if (up !== -1 && mask.has(matterType(tiles[up]))) return up
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

  borderingAdjacentAny(tx: number, ty: number, idx: number, mask: MatterTypeSet): boolean {
    const { tiles, width, height } = this
    const atBottom = ty === height - 1
    const atTop = ty === 0

    if (!atBottom) {
      const b = idx + width
      if (mask.has(matterType(tiles[b]))) return true
      if (tx > 0 && mask.has(matterType(tiles[b - 1]))) return true
      if (tx < width - 1 && mask.has(matterType(tiles[b + 1]))) return true
    }
    if (tx > 0 && mask.has(matterType(tiles[idx - 1]))) return true
    if (tx < width - 1 && mask.has(matterType(tiles[idx + 1]))) return true
    if (!atTop) {
      const a = idx - width
      if (mask.has(matterType(tiles[a]))) return true
      if (tx > 0 && mask.has(matterType(tiles[a - 1]))) return true
      if (tx < width - 1 && mask.has(matterType(tiles[a + 1]))) return true
    }
    return false
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
  surroundedByAny(tx: number, ty: number, idx: number, mask: MatterTypeSet): boolean {
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
   * Spread self into an adjacent tile of `intoType`. `chance` is 0–99.
   */
  doGrow(
    tx: number, ty: number, idx: number,
    intoType: MatterType, chance: number,
  ): boolean {
    if (random() >= chance) return false
    const loc = this.borderingAdjacent(tx, ty, idx, intoType)
    if (loc === -1) return false
    this.tiles[loc] = matterType(this.tiles[idx])
    const lx = loc % this.width
    const ly = loc / this.width | 0
    this.markDirty(lx, ly)
    this.next.add(loc)
    return true
  }

  /**
   * Set all 4 cardinal neighbours to FIRE and self to FIRE.
   */
  doBorderBurn(tx: number, ty: number, idx: number, ownerId: MatterTankId) {
    const { tiles, width, height } = this
    const ownerFire = setOwner(FIRE, ownerId)
    if (ty > 0) {
      tiles[idx - width] = ownerFire
      this.markDirty(tx, ty - 1)
      this.next.add(idx - width)
    }
    if (ty < height - 1) {
      tiles[idx + width] = ownerFire
      this.markDirty(tx, ty + 1)
      this.next.add(idx + width)
    }
    if (tx > 0) {
      tiles[idx - 1] = ownerFire
      this.markDirty(tx - 1, ty)
      this.next.add(idx - 1)
    }
    if (tx < width - 1) {
      tiles[idx + 1] = ownerFire
      this.markDirty(tx + 1, ty)
      this.next.add(idx + 1)
    }
    tiles[idx] = ownerFire
    this.markDirty(tx, ty)
    this.next.add(idx)
  }

  private _transferBuf = new Int32Array(256 * 3)
  private _transferLen = 0

  queueMatterCredit(tx: number, ty: number, ownerId: MatterTankId) {
    const needed = this._transferLen + 3
    if (needed > this._transferBuf.length) {
      const bigger = new Int32Array(this._transferBuf.length * 2)
      bigger.set(this._transferBuf)
      this._transferBuf = bigger
    }
    this._transferBuf[this._transferLen++] = tx
    this._transferBuf[this._transferLen++] = ty
    this._transferBuf[this._transferLen++] = ownerId
  }

  queueMatterCreditFromTile(tx: number, ty: number, idx: number) {
    const ownerId = getOwner(this.tiles[idx])
    if (!ownerId) {
      const label = MatterType[matterType(this.tiles[idx] as MatterType)]
      throw new Error('no owner found for: ' + label)
    }
    this.queueMatterCredit(tx, ty, ownerId)
  }

  flushTransferToMatterTank(): Int32Array {
    const len = this._transferLen
    if (len === 0) return new Int32Array(0)
    const buf = this._transferBuf.buffer
    this._transferBuf = new Int32Array(Math.max(256 * 3, len))
    this._transferLen = 0
    return new Int32Array(buf, 0, len)
  }

  doPowderFall(tx: number, ty: number, idx: number) {
    if (isAnchored(this.tiles[idx])) return

    const leftFirst = this.leftFirst

    const moved =
      this.tryMove(idx, tx, ty, tx, ty + 1) ||
      this.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1) ||
      this.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1)

    if (!moved) {
      const ty1 = ty + 1
      if (ty1 >= this.height) {
        // Map boundary — unconditionally settled.
        this.tiles[idx] = setSettled(this.tiles[idx], true)
        this.markDirty(tx, ty)
        this.justSettled.push(idx)
      } else {
        // Only commit to settled if all three fall positions are blocked by stable
        // material (solid/settled). If any is occupied by unsettled (falling) sand,
        // stay active — the blocker will move soon and free this tile.
        const { tiles, width } = this
        const row = ty1 * width
        const dL = tx > 0 ? tx - 1 : tx
        const dR = tx < width - 1 ? tx + 1 : tx
        if (
          isSolid(tiles[row + tx]) &&
          isSolid(tiles[row + dL]) &&
          isSolid(tiles[row + dR])
        ) {
          this.tiles[idx] = setSettled(this.tiles[idx], true)
          this.markDirty(tx, ty)
          this.justSettled.push(idx)
        } else {
          this.next.add(idx)
        }
      }
    }

    return moved
  }

  tryLiquidFlow(tx: number, ty: number, idx: number) {
    if (isAnchored(this.tiles[idx])) return

    const leftFirst = this.leftFirst

    return this.tryMove(idx, tx, ty, tx, ty + 1) ||
      this.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1) ||
      this.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1) ||
      this.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1) ||
      this.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1)
  }
}
