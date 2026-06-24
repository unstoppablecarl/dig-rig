import { CHUNK_SIZE } from '../../../../config.ts'
import { random } from '../../../../helpers/random.ts'
import {
  EMPTY,
  FIRE,
  isSettled,
  MatterType,
  matterType,
  setOwner,
  setSettled,
  SupportType,
} from '../../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../../Matter/data/MatterTypeSet.ts'
import {
  ACID_IMMUNE,
  ACTIVATABLE_TYPES,
  ALWAYS_ACTIVE_TYPES,
  getSupportType,
  LAVA_IMMUNE,
  LIQUID_TYPES,
  MATTER_ACTIONS,
  SINKS_THROUGH,
} from '../../../Matter/matter.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import { ParticleType } from '../../../Particles/_particle-types.ts'
import { ChunkGrid, type ChunkGridBuffers } from '../../../Tilemap/ChunkGrid.ts'
import type { Tile } from '../../../Tilemap/TileGrid.ts'
import { MatterCreditTransferBuffer } from '../_helpers/MatterCreditTransferBuffer.ts'
import { type SimInMsgProcess, SimOutMsg, type SimOutMsgDone, type SimOutMsgSpawnParticle } from './MatterSim.types.ts'

const MAX_FLOW = 8

export class MatterSim {
  tiles!: Uint32Array
  chunkGrid!: ChunkGrid
  width = 0
  height = 0
  chunkShift = 0
  chunksWidth = 0

  private matterTankCredits: MatterCreditTransferBuffer

  readonly LAVA_IMMUNE = LAVA_IMMUNE
  readonly ACID_IMMUNE = ACID_IMMUNE

  // Set externally by coordinator/pool before processSubset
  frame = 0
  leftFirst = false
  vfxJustSettled: number[] = []
  destroyedTiles: number[] = []
  next = new Set<number>()

  init(
    tilesBuffer: SharedArrayBuffer,
    chunkBuffers: ChunkGridBuffers,
    width: number,
    height: number,
  ) {
    this.tiles = new Uint32Array(tilesBuffer)
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
    this.destroyedTiles.length = 0
    this.processSubset(indices)

    out.next = Array.from(this.next)
    out.vfxJustSettled = this.vfxJustSettled
    out.destroyedTiles = this.destroyedTiles
    out.matterTankTransfers = this.matterTankCredits.flush()

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

    if (getSupportType(raw) >= SupportType.STRUCTURAL || !ACTIVATABLE_TYPES.has(t)) return
    if (!ALWAYS_ACTIVE_TYPES.has(t)) {
      this.tiles[idx] = setSettled(raw, false)
    }
    this.markDirtyRaw(idx)
    target.add(idx)
  }

// Runs matterType actions for the given tile indices. Pool workers call this
  // once per round with their assigned subset of the active set.
  processSubset(indices: number[]) {
    const phase = this.frame & 1
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

  markDirtyRaw(idx: number) {
    const tx = idx % this.width
    const ty = idx / this.width | 0
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

    // Wake the horizontal chain of settled liquids so pools level quickly
    for (const dir of this._reactiveAroundRange) {
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
    const row = fromTy * width
    const rowBelow = (fromTy + 1) * width
    const hasBelow = fromTy + 1 < height
    let dist = 0
    for (let d = 1; d <= MAX_FLOW; d++) {
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
    this.reactivateAround(tx, ty)
    if (ty > 0) this.reactivateAround(tx, ty - 1)
    if (tx > 0) this.reactivateAround(tx - 1, ty)
    if (tx < width - 1) this.reactivateAround(tx + 1, ty)
  }

  // Erase a terrain tile and register it for coordinator-side island-collapse checking.
  // Call this whenever a simulation rule destroys a tile that could be structural.
  destroyTile(x: number, y: number, idx: number) {
    this.tiles[idx] = EMPTY
    this.markDirty(x, y)
    this.next.add(idx)
    this.destroyedTiles.push(idx)
  }

  queueMatterCredit(tx: number, ty: number, ownerId: MatterTankId) {
    this.matterTankCredits.queueCredit(tx, ty, ownerId)
  }

  queueMatterCreditFromTile(tx: number, ty: number, idx: number) {
    this.matterTankCredits.queueCreditFromTile(tx, ty, idx)
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

  tryLiquidFlow(tx: number, ty: number, idx: number) {
    if (getSupportType(this.tiles[idx]) === SupportType.ANCHORED) return

    const leftFirst = this.leftFirst

    return this.tryMove(idx, tx, ty, tx, ty + 1) ||
      this.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1) ||
      this.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1) ||
      this.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1) ||
      this.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1)
  }
}

function isSolid(value: number) {
  return getSupportType(value) > SupportType.NONE || isSettled(value)
}
