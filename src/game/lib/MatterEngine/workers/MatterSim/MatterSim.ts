import { CHUNK_SIZE } from '../../../../config.ts'
import { random } from '../../../../helpers/random.ts'
import {
  FILL_COL_SCAN_MAX,
  FILL_COMPRESSION_FACTOR,
  FILL_MAX,
  FILL_MIN,
  FILL_PRESSURE_DIVISOR,
  FILL_ROUND_TO_ZERO,
  FILL_ROW_SCAN_MAX,
  FILL_SETTLED_FACTOR,
} from '../../../Matter/_Liquid.constants.ts'
import {
  EMPTY,
  FIRE,
  getOwner,
  isSettled,
  MatterType,
  matterType,
  setOwner,
  setSettled,
  SupportType,
} from '../../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../../Matter/data/MatterTypeSet.ts'
import {
  getReserveDestroyAmount,
  getSupportType,
  isActivatable,
  isAlwaysActive,
  isDestructible,
  isLiquid,
  MATTER_ACTIONS,
  RESERVED_DESTROY_CHARGE,
  SINKS_THROUGH,
} from '../../../Matter/matter.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import { ParticleType } from '../../../Particles/_particle-types.ts'
import { ChunkGrid, type ChunkGridBuffers } from '../../../Tilemap/ChunkGrid.ts'
import type { Tile } from '../../../Tilemap/TileGrid.ts'
import { MatterCreditTransferBuffer } from '../_helpers/MatterCreditTransferBuffer.ts'
import { MatterReservationReleaseBuffer } from '../_helpers/MatterReservationReleaseBuffer.ts'
import { type SimInMsgProcess, SimOutMsg, type SimOutMsgDone, type SimOutMsgSpawnParticle } from './MatterSim.types.ts'

export class MatterSim {
  tiles!: Uint32Array
  fill!: Float32Array
  chunkGrid!: ChunkGrid
  width = 0
  height = 0
  chunkShift = 0
  chunksWidth = 0

  private matterTankCredits: MatterCreditTransferBuffer
  private matterReservationReleases = new MatterReservationReleaseBuffer()

  // Set to true once PBF GPU simulation is confirmed active; disables CA liquid flow
  pbfActive = false

  // Set externally by coordinator/pool before processSubset
  frame = 0
  leftFirst = false
  vfxJustSettled: number[] = []
  structuralRemovals: number[] = []
  next = new Set<number>()

  init(
    tilesBuffer: SharedArrayBuffer,
    fillBuffer: SharedArrayBuffer,
    chunkBuffers: ChunkGridBuffers,
    width: number,
    height: number,
  ) {
    this.tiles = new Uint32Array(tilesBuffer)
    this.fill = new Float32Array(fillBuffer)

    this.width = width
    this.height = height
    this.chunkShift = Math.log2(CHUNK_SIZE)
    this.chunkGrid = ChunkGrid.fromBuffers(chunkBuffers)
    this.chunksWidth = this.chunkGrid.chunksWide
    this.matterTankCredits = new MatterCreditTransferBuffer(this.tiles)
  }

  process(
    indices: SimInMsgProcess['indices'],
    leftFirst: SimInMsgProcess['leftFirst'],
    frame: SimInMsgProcess['frame'],
    out: SimOutMsgDone,
  ): SimOutMsgDone {
    this.next.clear()
    this.frame = frame
    this.leftFirst = leftFirst
    this.vfxJustSettled.length = 0
    this.structuralRemovals.length = 0
    this.processSubset(indices)

    out.next = Array.from(this.next)
    out.vfxJustSettled = this.vfxJustSettled
    out.structuralRemovals = this.structuralRemovals
    out.matterTankTransfers = this.matterTankCredits.flush()
    out.matterReservationReleases = this.matterReservationReleases.flush()

    return out
  }

  private _spawnParticle: SimOutMsgSpawnParticle = {
    type: SimOutMsg.SPAWN_PARTICLE as const,
    particleType: ParticleType.NONE,
    x: 0,
    y: 0,
    ownerId: undefined,
  }

  spawnParticle(particleType: ParticleType, x: number, y: number, ownerId?: MatterTankId) {

    this._spawnParticle.particleType = particleType
    this._spawnParticle.x = x
    this._spawnParticle.y = y
    this._spawnParticle.ownerId = ownerId

    postMessage(this._spawnParticle)
  }

  // Wakes tiles in `target`. Called by coordinator on ACTIVATE messages.
  activateIndexes(indices: number[], target: Set<number>) {
    for (const idx of indices) {
      this.activate(idx, target)
    }
  }

  activateTiles(tiles: Tile[], target: Set<number>) {
    for (const { x, y } of tiles) {
      const idx = y * this.width + x
      this.activate(idx, target)
    }
  }

  activate(idx: number, target: Set<number>) {
    if (idx < 0 || idx >= this.tiles.length) return
    const raw = this.tiles[idx]
    const t = matterType(raw)

    if (getSupportType(raw) >= SupportType.STRUCTURAL || !isActivatable(t)) return
    if (!isAlwaysActive(t)) {
      this.tiles[idx] = setSettled(raw, false)
    }
    this.markDirtyRaw(idx)
    target.add(idx)
  }

  // Runs matterType actions for the given tile indices. Pool workers call this
  // once per round with their assigned subset of the active set.
  processSubset(indices: number[]) {
    const phase = this.frame & 1

    if (this.frame % 2 === 0) {
      indices.reverse()
    }
    for (const idx of indices) {
      const tx = idx % this.width
      const ty = idx / this.width | 0

      // Per-cell checkerboard: defer wrong-phase cells to next step to prevent
      // double-processing when an matterType moves into a neighbour's position.
      if (((tx + ty) & 1) !== phase) {
        this.next.add(idx)
        continue
      }

      const raw = this.tiles[idx]
      const tile = matterType(raw)
      if (import.meta.env.DEV) {
        if (!MATTER_ACTIONS[tile]) {
          throw new Error(`MatterSim: no action registered for type ${tile} — ensure matter.ts is imported before MatterSim is used`)
        }
      }

      MATTER_ACTIONS[tile](this, tx, ty, idx)
    }
  }

  markDirty(tx: number, ty: number) {
    const idx = (ty >>> this.chunkShift) * this.chunksWidth + (tx >>> this.chunkShift)

    this.chunkGrid.markDirty(idx)
  }

  markDirtyRaw(tileIdx: number) {
    const tx = tileIdx % this.width
    const ty = tileIdx / this.width | 0
    this.markDirty(tx, ty)
  }

  private _reactiveAroundRange = [-1, 1]

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

    // Wake the horizontal chain of settled liquids so pools level quickly.
    for (const dir of this._reactiveAroundRange) {
      for (let d = 1; d <= FILL_ROW_SCAN_MAX; d++) {
        const ax = tx + dir * d
        if (ax < 0 || ax >= width) break
        const sidx = ty * width + ax
        const raw = tiles[sidx]
        if (!isSettled(raw) || !isLiquid(matterType(raw))) break
        tiles[sidx] = setSettled(raw, false)
        dest.add(sidx)
      }
    }
  }

  // ─── Movement primitives ──────────────────────────────────────────────────

  // Sum of same-type fill levels in the contiguous column strictly above (tx, ty).
  // Stops at any non-liquid cell (empty gap, wall, or different type) — a gap breaks
  // the pressure column so a floating body above does not count as weight below.
  private colPressureAbove(tx: number, ty: number, type: MatterType): number {
    const { tiles, fill, width } = this
    let p = 0
    for (let dy = 1; dy <= FILL_COL_SCAN_MAX; dy++) {
      const yy = ty - dy
      if (yy < 0) break
      const ii = yy * width + tx
      if (matterType(tiles[ii]) !== type) break
      p += fill[ii]
    }
    return p
  }

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

    tiles[toIdx] = setSettled(rawFrom, false)
    tiles[fromIdx] = toType === EMPTY ? EMPTY : setSettled(rawTo, false)
    this.markDirty(fromTx, fromTy)
    this.markDirty(toTx, toTy)
    this.next.add(toIdx)

    if (toType !== EMPTY) {
      // Swap fill so the displaced liquid keeps its mass at fromIdx.
      // Without this, the liquid gets fill=0 and becomes a zombie tile.
      const tmp = this.fill[fromIdx]
      this.fill[fromIdx] = this.fill[toIdx]
      this.fill[toIdx] = tmp
      this.next.add(fromIdx)
    } else {
      this.fill[toIdx] = 0
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

    // swap fill levels between the two tiles
    const selfFill = this.fill[idx]
    this.fill[idx] = this.fill[targetIdx]
    this.fill[targetIdx] = selfFill

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
    const row = fromTy * width
    const rowBelow = (fromTy + 1) * width
    const hasBelow = fromTy + 1 < height
    let dist = 0
    for (let d = 1; d <= FILL_ROW_SCAN_MAX; d++) {
      const nx = fromTx + dir * d
      if (nx < 0 || nx >= width) break
      if (matterType(tiles[row + nx]) !== EMPTY) break
      dist = d
      if (hasBelow && matterType(tiles[rowBelow + nx]) === EMPTY) break
    }
    if (dist === 0) return false
    return this.tryMove(fromIdx, fromTx, fromTy, fromTx + dir * dist, fromTy)
  }

  // ─── Higher-level helpers (mirrors project-sand World API) ────────────────

  /** Clear SETTLED_FLAG on all 4-directional neighbours whose base type matches `type`. */
  wakeSettledNeighbors(tx: number, ty: number, idx: number, type: MatterType) {
    const { tiles, width, height } = this
    let nidx: number, raw: number
    if (ty > 0) {
      nidx = idx - width
      raw = tiles[nidx]
      if (matterType(raw) === type && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirty(tx, ty - 1)
        this.next.add(nidx)
      }
    }
    if (ty < height - 1) {
      nidx = idx + width
      raw = tiles[nidx]
      if (matterType(raw) === type && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirty(tx, ty + 1)
        this.next.add(nidx)
      }
    }
    if (tx > 0) {
      nidx = idx - 1
      raw = tiles[nidx]
      if (matterType(raw) === type && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirty(tx - 1, ty)
        this.next.add(nidx)
      }
    }
    if (tx < width - 1) {
      nidx = idx + 1
      raw = tiles[nidx]
      if (matterType(raw) === type && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirty(tx + 1, ty)
        this.next.add(nidx)
      }
    }
  }

  wakeSettledNeighborTypes(tx: number, ty: number, idx: number, targets: MatterTypeSet) {
    const { tiles, width, height } = this
    let nidx: number, raw: number
    if (ty > 0) {
      nidx = idx - width
      raw = tiles[nidx]
      if (targets.has(matterType(raw)) && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirty(tx, ty - 1)
        this.next.add(nidx)
      }
    }
    if (ty < height - 1) {
      nidx = idx + width
      raw = tiles[nidx]
      if (targets.has(matterType(raw)) && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirty(tx, ty + 1)
        this.next.add(nidx)
      }
    }
    if (tx > 0) {
      nidx = idx - 1
      raw = tiles[nidx]
      if (targets.has(matterType(raw)) && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirty(tx - 1, ty)
        this.next.add(nidx)
      }
    }
    if (tx < width - 1) {
      nidx = idx + 1
      raw = tiles[nidx]
      if (targets.has(matterType(raw)) && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirty(tx + 1, ty)
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
   * Credit and set self + all 4 cardinal neighbours to FIRE (skipping PERMANENT).
   */
  doBorderBurn(tx: number, ty: number, idx: number, ownerId: MatterTankId) {
    const { tiles, width, height } = this
    const ownerFire = setOwner(FIRE, ownerId)
    const cells: [number, number, number][] = [
      [tx, ty, idx],
      [tx, ty - 1, idx - width],
      [tx, ty + 1, idx + width],
      [tx - 1, ty, idx - 1],
      [tx + 1, ty, idx + 1],
    ]
    for (const [cx, cy, cidx] of cells) {
      if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue
      const t = matterType(tiles[cidx])
      if (!isDestructible(t)) continue
      if (t !== EMPTY) this.queueMatterCredit(cx, cy, ownerId)
      tiles[cidx] = ownerFire
      this.markDirty(cx, cy)
      this.next.add(cidx)
    }
    this.reactivateAround(tx, ty)
    if (ty > 0) this.reactivateAround(tx, ty - 1)
    if (ty < height - 1) this.reactivateAround(tx, ty + 1)
    if (tx > 0) this.reactivateAround(tx - 1, ty)
    if (tx < width - 1) this.reactivateAround(tx + 1, ty)
  }

  // Erase a terrain tile and register it for coordinator-side island-collapse checking.
  // Call this whenever a simulation rule destroys a tile that could be structural.
  destroyTile(x: number, y: number, idx: number) {
    const raw = this.tiles[idx]
    const t = matterType(raw)
    if (RESERVED_DESTROY_CHARGE.has(t)) {
      this.queueReservationRelease(getOwner(raw), getReserveDestroyAmount(t))
    }
    this.fill[idx] = 0
    this.tiles[idx] = EMPTY
    this.markDirty(x, y)
    this.next.add(idx)
    if (getSupportType(raw) >= SupportType.STRUCTURAL) {
      this.structuralRemovals.push(idx)
    }
  }

  queueMatterCredit(tx: number, ty: number, ownerId: MatterTankId) {
    this.matterTankCredits.queueCredit(tx, ty, ownerId)
  }

  queueMatterCreditFromTile(tx: number, ty: number, idx: number) {
    this.matterTankCredits.queueCreditFromTile(tx, ty, idx)
  }

  queueReservationRelease(ownerId: MatterTankId, amount: number) {
    if (amount === 0) return
    this.matterReservationReleases.queueRelease(ownerId, amount)
  }

  doPowderFall(tx: number, ty: number, idx: number) {
    const raw = this.tiles[idx]
    if (getSupportType(raw) === SupportType.ANCHORED) return

    const leftFirst = this.leftFirst

    const moved =
      this.tryMove(idx, tx, ty, tx, ty + 1) ||
      this.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1) ||
      this.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1)

    if (!moved) {
      const ty1 = ty + 1
      if (ty1 >= this.height) {
        // Map boundary — unconditionally settled.
        this.tiles[idx] = setSettled(raw, true)
        this.markDirty(tx, ty)
        this.vfxJustSettled.push(idx)
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
          this.tiles[idx] = setSettled(raw, true)
          this.markDirty(tx, ty)
          this.vfxJustSettled.push(idx)
        } else {
          this.next.add(idx)
        }
      }
    }

    return moved
  }

  private doFillTransfer(
    fromIdx: number, fromTx: number, fromTy: number,
    toIdx: number, toTx: number, toTy: number,
    amount: number,
    liquidRaw: number,
  ): void {
    const wasEmpty = this.fill[toIdx] === 0
    this.fill[fromIdx] -= amount
    this.fill[toIdx] += amount

    if (this.fill[fromIdx] < FILL_ROUND_TO_ZERO) {
      this.fill[fromIdx] = 0
      this.tiles[fromIdx] = EMPTY
      this.markDirty(fromTx, fromTy)
      this.reactivateAround(fromTx, fromTy)
    } else {
      this.tiles[fromIdx] = setSettled(this.tiles[fromIdx], false)
      this.markDirty(fromTx, fromTy)
      this.next.add(fromIdx)
      // Wake settled neighbours so they re-equalize against the new lower fill
      this.reactivateAround(fromTx, fromTy)
    }

    // Wake settled liquid directly below the sender — it may be pressurized and
    // waiting to push upward. When the sender loses fill the column above opens up.
    if (fromTy < this.height - 1) {
      const belowFromIdx = fromIdx + this.width
      const belowRaw = this.tiles[belowFromIdx]
      if (isLiquid(matterType(belowRaw)) && isSettled(belowRaw)) {
        this.tiles[belowFromIdx] = setSettled(belowRaw, false)
        this.markDirtyRaw(belowFromIdx)
        this.next.add(belowFromIdx)
      }
    }

    if (wasEmpty) {
      this.tiles[toIdx] = liquidRaw
    } else {
      this.tiles[toIdx] = setSettled(this.tiles[toIdx], false)
    }
    this.markDirty(toTx, toTy)
    this.next.add(toIdx)
  }

  // Returns how much fill the lower of two stacked cells should hold.
  // Yields > FILL_MAX when total > FILL_MAX, creating a small compression
  // that drives upward pressure flow (U-tube equalization).
  private static getStableState(total: number): number {
    const compress = FILL_MAX * FILL_COMPRESSION_FACTOR
    if (total <= FILL_MAX) return FILL_MAX
    if (total < 2 * FILL_MAX + compress)
      return (FILL_MAX * FILL_MAX + total * compress) / (FILL_MAX + compress)
    return (total + compress) / 2
  }

  tryFillFlow(tx: number, ty: number, idx: number): boolean {
    const { tiles, fill, width, height } = this

    const mass = fill[idx]
    if (mass < FILL_MIN) return false

    const type = matterType(tiles[idx])
    const liquidRaw = setSettled(tiles[idx], false)
    let remaining = mass
    let moved = false

    // ── 1. Gravity ───────────────────────────────────────────────────────────
    let downIdx = -1
    let downMovable = false
    if (ty + 1 < height) {
      downIdx = idx + width
      const downType = matterType(tiles[downIdx])
      downMovable = downType === EMPTY || downType === type
      if (downMovable) {
        const want = MatterSim.getStableState(mass + fill[downIdx]) - fill[downIdx]
        if (want > 0) {
          const flow = Math.min(want, Math.min(FILL_MAX, remaining))
          this.doFillTransfer(idx, tx, ty, downIdx, tx, ty + 1, flow, liquidRaw)
          remaining -= flow
          moved = true
          if (remaining < FILL_MIN) return true
        }
      }
    }

    // ── Settled check ────────────────────────────────────────────────────────
    // Only equalize sideways when blocked below or cell below is well-filled.
    const downWall = !downMovable
    const settled = downWall || fill[downIdx] >= FILL_MAX * FILL_SETTLED_FACTOR
    if (!settled) return moved

    // ── 2. Horizontal equalization ───────────────────────────────────────────
    // Column-pressure equalization at every settled row, not just the floor.
    // myCP = fill + weight of same-type liquid above this cell. A taller column
    // has higher myCP than a shorter neighbour at the same y, so interior tiles
    // in a pile also drive flow outward — not just the single outermost edge tile.
    const ax = tx + (this.leftFirst ? -1 : 1)
    const bx = tx + (this.leftFirst ? 1 : -1)
    const myCP = remaining + this.colPressureAbove(tx, ty, type)

    let wantA = 0, aIdx = -1
    if (ax >= 0 && ax < width) {
      aIdx = ty * width + ax
      const aType = matterType(tiles[aIdx])
      if (aType === EMPTY || aType === type)
        wantA = Math.max(0, (myCP - fill[aIdx] - this.colPressureAbove(ax, ty, type)) / FILL_PRESSURE_DIVISOR)
    }

    let wantB = 0, bIdx = -1
    if (bx >= 0 && bx < width) {
      bIdx = ty * width + bx
      const bType = matterType(tiles[bIdx])
      if (bType === EMPTY || bType === type)
        wantB = Math.max(0, (myCP - fill[bIdx] - this.colPressureAbove(bx, ty, type)) / FILL_PRESSURE_DIVISOR)
    }

    const total = wantA + wantB
    if (total > FILL_MIN) {
      const budget = Math.min(remaining, total)
      if (wantA > FILL_MIN) {
        const f = budget * wantA / total
        this.doFillTransfer(idx, tx, ty, aIdx, ax, ty, f, liquidRaw)
        remaining -= f
        moved = true
      }
      if (wantB > FILL_MIN && remaining > FILL_MIN) {
        const f = budget * wantB / total
        this.doFillTransfer(idx, tx, ty, bIdx, bx, ty, f, liquidRaw)
        remaining -= f
        moved = true
      }
    }

    if (remaining < FILL_MIN) return true

    // ── 3. Upward pressure ───────────────────────────────────────────────────
    // Push excess above FILL_MAX upward. Wakeup propagates the cascade over
    // multiple sub-steps so U-tube arms equalize within a single rendered frame.
    if (remaining > FILL_MAX && ty > 0) {
      const upIdx = idx - width
      const upType = matterType(tiles[upIdx])
      if (upType === EMPTY || upType === type) {
        const want = remaining - MatterSim.getStableState(remaining + fill[upIdx])
        if (want > FILL_MIN) {
          const flow = Math.min(want, remaining - FILL_MAX)
          this.doFillTransfer(idx, tx, ty, upIdx, tx, ty - 1, flow, liquidRaw)
          moved = true
        }
      }
    }

    return moved
  }

  // Bottom-to-top upward pressure cascade (mirrors test4.html Pass 2).
  // Takes the current active set, sorts it by y descending (bottommost first),
  // and for each overfull liquid cell pushes excess upward in-place. Because
  // we process bottom-to-top, a newly overfull cell at y-1 is already next in
  // the sorted list, so the full column cascades in a single pass.
  // Must be called after all worker rounds finish (no concurrent writers).
  doUpwardPressurePass(activeSet: Set<number>): void {
    const { tiles, fill, width } = this

    // Sort once by y descending so bottom cells are processed first.
    const sorted = Array.from(activeSet).sort((a, b) => b - a)

    for (const idx of sorted) {
      if (idx < width) continue  // top row — no cell above
      const raw = tiles[idx]
      if (!isLiquid(matterType(raw))) continue
      const m = fill[idx]
      if (m <= FILL_MAX) continue

      const upIdx = idx - width
      const upType = matterType(tiles[upIdx])
      const type = matterType(raw)
      const upValid = upType === EMPTY || upType === type
      if (!upValid) continue

      const want = m - MatterSim.getStableState(m + fill[upIdx])
      if (want <= FILL_MIN) continue
      const flow = Math.min(want, m - FILL_MAX)

      fill[idx] -= flow
      fill[upIdx] += flow

      if (upType === EMPTY) {
        tiles[upIdx] = setSettled(raw, false)
      } else {
        tiles[upIdx] = setSettled(tiles[upIdx], false)
      }

      const tx = idx % width
      const ty = (idx / width) | 0
      this.markDirty(tx, ty - 1)
      this.markDirty(tx, ty)
      activeSet.add(upIdx)
      activeSet.add(idx)
    }
  }
}

function isSolid(value: number) {
  return getSupportType(value) > SupportType.NONE || isSettled(value)
}
