import { CHUNK_SIZE, ENABLE_MATTER_SIM_PROFILING } from '../../../../config.ts'
import { random } from '../../../../helpers/random.ts'
import {
  FILL_COL_SCAN_MAX,
  FILL_COMPRESSION_FACTOR,
  FILL_MAX,
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
  type MatterValue,
  setOwner,
  setSettled,
  SupportType,
} from '../../../Matter/_Matter.types.ts'
import { MatterTypeSet } from '../../../Matter/data/MatterTypeSet.ts'
import type { TileSet } from '../../../Matter/data/SparseTileSet.ts'
import {
  alwaysCollides,
  collidesWhenSettled,
  convertsToCollisionBody,
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
import { ParticleSpawnData } from '../../data/ParticleSpawnData.ts'
import { MatterCreditTransferBuffer } from '../_helpers/MatterCreditTransferBuffer.ts'
import { MatterReservationReleaseBuffer } from '../_helpers/MatterReservationReleaseBuffer.ts'
import { type SimOutMsgDoneWire } from './MatterSim.types.ts'
import { MatterSimScratchData, SIM_SCRATCH_CAPACITY, type SimScratchBuffers } from './MatterSimScratchData.ts'

// Copies an iterable of tile indices into a shared scratch view, clamped to
// capacity (dropping and warning on overflow rather than throwing/corrupting
// memory — an overflow just means those entries wait for the next tick, same
// as any other blocked/deferred tile).
function copyIntoView(view: Int32Array, capacity: number, source: Iterable<number>): number {
  let n = 0
  for (const v of source) {
    if (n >= capacity) {
      console.warn(`MatterSim: scratch buffer overflow (capacity=${capacity}), dropping remaining entries`)
      break
    }
    view[n++] = v
  }
  return n
}

export class MatterSim {
  tiles!: Uint32Array
  fill!: Uint32Array
  // Per-tile last-touched frame stamp, shared across every worker in the pool
  // (same buffer instance for all of them, like tiles/fill). A tick dispatches
  // its active-tile snapshot across up to 4 sequential rounds (see
  // SimWorkerPool's mega-groups), each round's index batch fixed from the
  // snapshot taken before any of them ran. If a round's move writes matter
  // into an index that a *later* round in the same tick was independently
  // about to process (that index was itself active pre-tick), that later
  // round would run MATTER_ACTIONS a second time this tick on matter that
  // already got its one update — a double-move that can cross a chunk (and
  // therefore round) boundary. touched[idx] === frame+1 means "already
  // updated this tick" (frame+1, never 0, so it can't collide with the
  // buffer's zero-initialized default on frame 0); processSubset checks it
  // before running an action, and every primitive that relocates a tile's
  // identity to a different index (tryMove, tryRise, doDensityLiquid's swap)
  // stamps the destination so a stale later round skips it instead of
  // re-processing it. Rounds are awaited sequentially and same-round workers
  // only ever touch non-adjacent chunks, so plain (non-atomic) reads/writes
  // here are safe.
  touched!: Uint32Array
  chunkGrid!: ChunkGrid
  width = 0
  height = 0
  chunkShift = 0
  chunksWidth = 0

  private matterTankCredits: MatterCreditTransferBuffer
  private matterReservationReleases = new MatterReservationReleaseBuffer()

  // Set externally by coordinator/pool before processSubset
  frame = 0
  leftFirst = false
  vfxJustSettled: number[] = []
  structuralRemovals: number[] = []
  next = new Set<number>()

  // Shared scratch space for cross-thread payloads — coordinator writes
  // indices in, we write results out via the other three fields, avoiding a
  // postMessage structured-clone of what can be a many-thousand-entry array
  // on every round.
  private scratch!: MatterSimScratchData

  // Tracked across one process() call for conservation accounting.
  // liquid: fill units created/consumed by matter reactions (not CA flow).
  // solid: tile-count created/consumed by reactions without corresponding tank credit/debit.
  private liquidFillConsumed = 0
  private liquidFillCreated = 0
  private solidTilesConsumed = 0
  private solidTilesCreated = 0

  // Cheap call-count profiling, gated by ENABLE_MATTER_SIM_PROFILING — plain
  // integer increments at each function's single choke point, not
  // performance.now() timers (which would add real self-measurement overhead
  // at ~200k calls/round). Used to check which hot-path functions are
  // actually called as often as reading the code suggests, before
  // considering any optimization there.
  private _profTryFillFlowCalls = 0
  private _profColPressureAboveCalls = 0
  private _profReactivateAroundCalls = 0
  private _profDoFillTransferCalls = 0
  // markDirty call count vs countSolidInChunk's tiles-scanned count (see
  // PhysicsCollapse profiling) — checks whether an incremental solidCount
  // scheme keyed off markDirty calls would actually visit fewer tiles than
  // the current full-chunk rescan, before building it.
  private _profMarkDirtyCalls = 0
  private _profWindowStart = performance.now()

  // Sampled wall-clock cost (every 64th call, via the call-count mask below)
  // for the two functions actually in question — call counts alone don't
  // tell you cost per call, and timing every call would itself add real
  // overhead at ~500k-800k calls/sec.
  private _profColPressureAboveTime = 0
  private _profColPressureAboveSamples = 0
  private _profTryFillFlowTime = 0
  private _profTryFillFlowSamples = 0
  // Same sampled-timing treatment for the granular/powder path (sand's
  // MATTER_ACTIONS entry point and its movement primitive) — call counts
  // alone (reactivateAround etc.) don't say whether the ~23ms/step dispatch
  // cost for a falling-sand scenario is many cheap per-tile ops or has a hot
  // inner cost worth trimming.
  private _profDoPowderFallTime = 0
  private _profDoPowderFallSamples = 0
  private _profDoPowderFallCalls = 0
  private _profTryMoveTime = 0
  private _profTryMoveSamples = 0
  private _profTryMoveCalls = 0
  private static readonly PROF_SAMPLE_MASK = 63

  private particles: ParticleSpawnData

  // The coordinator's own local MatterSim instance (used directly by
  // Brush/PhysicsBodyProcessor/etc., never dispatched through the worker
  // pool) never calls .process(), so its scratchBuffers just go unused —
  // still allocated uniformly here rather than made optional, to keep this
  // signature simple.
  init(
    tilesBuffer: SharedArrayBuffer,
    fillBuffer: SharedArrayBuffer,
    touchedBuffer: SharedArrayBuffer,
    chunkBuffers: ChunkGridBuffers,
    width: number,
    height: number,
    scratchBuffers: SimScratchBuffers,
    particlesBuffer: SharedArrayBuffer,
  ) {
    this.tiles = new Uint32Array(tilesBuffer)
    this.fill = new Uint32Array(fillBuffer)
    this.touched = new Uint32Array(touchedBuffer)

    this.width = width
    this.height = height
    this.chunkShift = Math.log2(CHUNK_SIZE)
    this.chunkGrid = new ChunkGrid(chunkBuffers)
    this.chunksWidth = this.chunkGrid.chunksWide
    this.matterTankCredits = new MatterCreditTransferBuffer(this.tiles)

    this.scratch = new MatterSimScratchData(scratchBuffers)
    this.particles = new ParticleSpawnData(particlesBuffer)
  }

  process(
    indicesCount: number,
    leftFirst: boolean,
    frame: number,
    out: SimOutMsgDoneWire,
  ): SimOutMsgDoneWire {
    const _profBusyT0 = ENABLE_MATTER_SIM_PROFILING ? performance.now() : 0
    this.next.clear()
    this.frame = frame
    this.leftFirst = leftFirst
    this.vfxJustSettled.length = 0
    this.structuralRemovals.length = 0
    this.liquidFillConsumed = 0
    this.liquidFillCreated = 0
    this.solidTilesConsumed = 0
    this.solidTilesCreated = 0
    this.processSubset(this.scratch.indices.subarray(0, indicesCount))

    out.nextCount = copyIntoView(this.scratch.next, SIM_SCRATCH_CAPACITY, this.next)
    out.vfxJustSettledCount = copyIntoView(this.scratch.vfxJustSettled, SIM_SCRATCH_CAPACITY, this.vfxJustSettled)
    out.structuralRemovalsCount = copyIntoView(this.scratch.structuralRemovals, SIM_SCRATCH_CAPACITY, this.structuralRemovals)
    out.matterTankTransfers = this.matterTankCredits.flush()
    out.matterReservationReleases = this.matterReservationReleases.flush()
    out.liquidNetDelta = this.liquidFillCreated - this.liquidFillConsumed
    out.solidNetDelta = this.solidTilesCreated - this.solidTilesConsumed
    out.busyMs = ENABLE_MATTER_SIM_PROFILING ? performance.now() - _profBusyT0 : 0

    if (ENABLE_MATTER_SIM_PROFILING) {
      const now = performance.now()
      if (now - this._profWindowStart > 1000) {
        const avgTryFillFlowUs = this._profTryFillFlowSamples > 0
          ? (this._profTryFillFlowTime / this._profTryFillFlowSamples) * 1000
          : 0
        const avgColPressureAboveUs = this._profColPressureAboveSamples > 0
          ? (this._profColPressureAboveTime / this._profColPressureAboveSamples) * 1000
          : 0
        const avgDoPowderFallUs = this._profDoPowderFallSamples > 0
          ? (this._profDoPowderFallTime / this._profDoPowderFallSamples) * 1000
          : 0
        const avgTryMoveUs = this._profTryMoveSamples > 0
          ? (this._profTryMoveTime / this._profTryMoveSamples) * 1000
          : 0
        console.log(
          `[PROFILE MatterSim] tryFillFlow=${this._profTryFillFlowCalls} `
          + `avg=${avgTryFillFlowUs.toFixed(2)}us (n=${this._profTryFillFlowSamples}) `
          + `colPressureAbove=${this._profColPressureAboveCalls} `
          + `(${(this._profColPressureAboveCalls / (this._profTryFillFlowCalls || 1)).toFixed(2)}/call) `
          + `avg=${avgColPressureAboveUs.toFixed(2)}us (n=${this._profColPressureAboveSamples}) `
          + `reactivateAround=${this._profReactivateAroundCalls} `
          + `(${(this._profReactivateAroundCalls / (this._profTryFillFlowCalls || 1)).toFixed(2)}/call) `
          + `doFillTransfer=${this._profDoFillTransferCalls} `
          + `(${(this._profDoFillTransferCalls / (this._profTryFillFlowCalls || 1)).toFixed(2)}/call) `
          + `markDirty=${this._profMarkDirtyCalls} `
          + `doPowderFall=${this._profDoPowderFallCalls} avg=${avgDoPowderFallUs.toFixed(2)}us (n=${this._profDoPowderFallSamples}) `
          + `tryMove=${this._profTryMoveCalls} `
          + `(${(this._profTryMoveCalls / (this._profDoPowderFallCalls || 1)).toFixed(2)}/call) `
          + `avg=${avgTryMoveUs.toFixed(2)}us (n=${this._profTryMoveSamples})`,
        )
        this._profWindowStart = now
        this._profTryFillFlowCalls = 0
        this._profColPressureAboveCalls = 0
        this._profReactivateAroundCalls = 0
        this._profDoFillTransferCalls = 0
        this._profMarkDirtyCalls = 0
        this._profTryFillFlowTime = 0
        this._profTryFillFlowSamples = 0
        this._profColPressureAboveTime = 0
        this._profColPressureAboveSamples = 0
        this._profDoPowderFallCalls = 0
        this._profDoPowderFallTime = 0
        this._profDoPowderFallSamples = 0
        this._profTryMoveCalls = 0
        this._profTryMoveTime = 0
        this._profTryMoveSamples = 0
      }
    }

    return out
  }

  spawnParticle(particleType: ParticleType, x: number, y: number, ownerId?: MatterTankId, vx?: number, vy?: number, value?: MatterValue) {
    this.particles.queue(particleType, x, y, ownerId, vx, vy, value)
  }

  // Wakes tiles in `target`. Called by coordinator on ACTIVATE messages.
  activateIndexes(indices: number[], target: TileSet) {
    for (const idx of indices) {
      this.activate(idx, target)
    }
  }

  activateTiles(tiles: Tile[], target: TileSet) {
    for (const { x, y } of tiles) {
      const idx = y * this.width + x
      this.activate(idx, target)
    }
  }

  activate(idx: number, target: TileSet) {
    if (idx < 0 || idx >= this.tiles.length) return
    const raw = this.tiles[idx]
    const t = matterType(raw)

    if (getSupportType(raw) >= SupportType.STRUCTURAL || !isActivatable(t)) return
    // activate() only ever flips the settled flag, never the type — so it can
    // only change collidability for a collidesWhenSettled type (e.g. SAND)
    // that was actually settled before this call. alwaysCollides types are
    // unaffected by the settled flag, and most activated tiles are liquid
    // (settles: true) which is never collidable — those get a render-only
    // refresh instead of forcing a terrain-body rebuild.
    const wasCollidable = collidesWhenSettled(t) && isSettled(raw)
    if (!isAlwaysActive(t)) {
      this.tiles[idx] = setSettled(raw, false)
    }
    if (wasCollidable) {
      this.markDirtyRaw(idx)
    } else {
      this.markRenderDirtyRaw(idx)
    }
    target.add(idx)
  }

  // Runs matterType actions for the given tile indices. Pool workers call this
  // once per round with their assigned subset of the active set.
  processSubset(indices: Int32Array) {
    for (const idx of indices) {
      // Already updated this tick — some earlier round (this same dispatch,
      // a different mega-group) moved matter into idx after this batch was
      // built from the pre-tick snapshot. Re-running its action here would
      // give it a second update in one tick. See `touched` field comment.
      // Stamped as frame+1, never 0, so it can't collide with the buffer's
      // zero-initialized default on frame 0 (the very first tick).
      if (this.touched[idx] === this.frame + 1) continue

      const tx = idx % this.width
      const ty = idx / this.width | 0

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
    if (ENABLE_MATTER_SIM_PROFILING) this._profMarkDirtyCalls++
    const idx = (ty >>> this.chunkShift) * this.chunksWidth + (tx >>> this.chunkShift)

    this.chunkGrid.markDirty(idx)
  }

  markDirtyRaw(tileIdx: number) {
    const tx = tileIdx % this.width
    const ty = tileIdx / this.width | 0
    this.markDirty(tx, ty)
  }

  // Render-only dirty — no collGen bump. Liquid tiles never contribute to
  // Matter.js collision geometry (no liquid MatterDef sets collidesWhenSettled
  // or alwaysCollides), so pure liquid-fill movement between liquid/empty
  // cells can never change collidability. Bumping collGen for it anyway forces
  // TerrainChunkBodyManager to tear down and rebuild the chunk's static body
  // on every such change, which is what made rigid bodies resting in water
  // (or anywhere near flowing/settling liquid in the same chunk) vibrate.
  markRenderDirty(tx: number, ty: number) {
    const idx = (ty >>> this.chunkShift) * this.chunksWidth + (tx >>> this.chunkShift)

    this.chunkGrid.markRenderDirty(idx)
  }

  markRenderDirtyRaw(tileIdx: number) {
    const tx = tileIdx % this.width
    const ty = tileIdx / this.width | 0
    this.markRenderDirty(tx, ty)
  }

  private _reactiveAroundRange = [-1, 1]

  // Re-activate settled material that could flow into (tx, ty) now that it is empty.
  // When called outside a step (from message handlers), pass an explicit dest set.
  reactivateAround(tx: number, ty: number, dest: TileSet = this.next) {
    if (ENABLE_MATTER_SIM_PROFILING) this._profReactivateAroundCalls++
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
          // Only types whose collidability actually depends on the settled
          // flag (e.g. SAND) need the collision mesh rebuilt. alwaysCollides
          // types stay collidable regardless, and most wakes here are liquid
          // (e.g. settled water above a physics body) which never collides —
          // bumping collGen for those is what forced the terrain body under a
          // resting object to be torn down and rebuilt every time nearby
          // water re-settled.
          this.markDirtyForWake(ax, aboveY, matterType(raw))
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
    if (ENABLE_MATTER_SIM_PROFILING) {
      this._profColPressureAboveCalls++
      if ((this._profColPressureAboveCalls & MatterSim.PROF_SAMPLE_MASK) === 0) {
        const t0 = performance.now()
        const result = this._colPressureAboveImpl(tx, ty, type)
        this._profColPressureAboveTime += performance.now() - t0
        this._profColPressureAboveSamples++
        return result
      }
    }
    return this._colPressureAboveImpl(tx, ty, type)
  }

  private _colPressureAboveImpl(tx: number, ty: number, type: MatterType): number {
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
    if (ENABLE_MATTER_SIM_PROFILING) {
      this._profTryMoveCalls++
      if ((this._profTryMoveCalls & MatterSim.PROF_SAMPLE_MASK) === 0) {
        const t0 = performance.now()
        const result = this._tryMoveImpl(fromIdx, fromTx, fromTy, toTx, toTy)
        this._profTryMoveTime += performance.now() - t0
        this._profTryMoveSamples++
        return result
      }
    }
    return this._tryMoveImpl(fromIdx, fromTx, fromTy, toTx, toTy)
  }

  private _tryMoveImpl(
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
    // fromIdx's matter now lives at toIdx and already had its one update this
    // tick (this call) — stamp toIdx so a later round this tick (toIdx could
    // have been independently active pre-tick, e.g. the sinksThrough case
    // overwriting a live liquid) skips it instead of moving it again.
    this.touched[toIdx] = this.frame + 1
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
      this.fill[toIdx] = this.fill[fromIdx]
      this.fill[fromIdx] = 0
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
      this.fill[toIdx] = this.fill[fromIdx]
      this.fill[fromIdx] = 0
      // fromIdx's matter now lives at toIdx and already had its update this tick.
      this.touched[toIdx] = this.frame + 1
      // Gas/fire only (tryRise's only callers) — never collidable, so render-only.
      this.markRenderDirty(fromTx, fromTy)
      this.markRenderDirty(tx, ty)
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
    // idx's matter now lives at targetIdx and already had its update this
    // tick — targetIdx held a live `lighter` tile pre-swap, which could be
    // independently active and scheduled in a later round this same tick.
    this.touched[targetIdx] = this.frame + 1

    // swap fill levels between the two tiles
    const selfFill = this.fill[idx]
    this.fill[idx] = this.fill[targetIdx]
    this.fill[targetIdx] = selfFill

    // When the displaced tile is a non-liquid (e.g. CHILLED_ICE), the lighter
    // liquid's fill was swapped onto a solid tile — zero it and track the change.
    if (displacedAs !== undefined && !isLiquid(matterType(displacedAs))) {
      this.liquidFillConsumed += this.fill[idx]
      this.fill[idx] = 0
      this.solidTilesCreated++
    }

    const tx2 = targetIdx % width
    const ty2 = (targetIdx / width) | 0
    // targetIdx always becomes `selfRaw`, which is always a liquid (this is only
    // ever called from a liquid's own action) — never collidable, render-only.
    // idx becomes `displacedAs ?? lighter`; both are liquid in the common case
    // (e.g. water sinking into oil) — only cryo's freeze-to-CHILLED_ICE path
    // actually creates a collidable solid there and needs the real collGen bump.
    if (displacedAs !== undefined && !isLiquid(matterType(displacedAs))) {
      this.markDirty(tx, ty)
    } else {
      this.markRenderDirty(tx, ty)
    }
    this.markRenderDirty(tx2, ty2)
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
        this.markDirtyForWake(tx, ty - 1, matterType(raw))
        this.next.add(nidx)
      }
    }
    if (ty < height - 1) {
      nidx = idx + width
      raw = tiles[nidx]
      if (targets.has(matterType(raw)) && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirtyForWake(tx, ty + 1, matterType(raw))
        this.next.add(nidx)
      }
    }
    if (tx > 0) {
      nidx = idx - 1
      raw = tiles[nidx]
      if (targets.has(matterType(raw)) && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirtyForWake(tx - 1, ty, matterType(raw))
        this.next.add(nidx)
      }
    }
    if (tx < width - 1) {
      nidx = idx + 1
      raw = tiles[nidx]
      if (targets.has(matterType(raw)) && isSettled(raw)) {
        tiles[nidx] = setSettled(raw, false)
        this.markDirtyForWake(tx + 1, ty, matterType(raw))
        this.next.add(nidx)
      }
    }
  }

  // Un-settling a tile only changes its collidability (needs collGen) when its
  // type's collision status actually depends on the settled flag. alwaysCollides
  // types stay collidable regardless, and non-collidable types (all liquids)
  // never were — both only need a render refresh.
  private markDirtyForWake(tx: number, ty: number, type: MatterType) {
    if (collidesWhenSettled(type) && !alwaysCollides(type)) {
      this.markDirty(tx, ty)
    } else {
      this.markRenderDirty(tx, ty)
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

  canStickToAnyColliding(tx: number, ty: number, idx: number): number {
    const { tiles, width } = this
    const left = tx > 0 ? idx - 1 : -1
    const right = tx < width - 1 ? idx + 1 : -1
    const up = ty > 0 ? idx - width : -1

    if (left !== -1 && convertsToCollisionBody(tiles[left])) return left
    if (right !== -1 && convertsToCollisionBody(tiles[right])) return right
    if (up !== -1 && convertsToCollisionBody(tiles[up])) return up
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

  getBorderingAdjacentTypeOrEmpty(tx: number, ty: number, idx: number, type: MatterType, exclude: Set<number>, out: number[]): number[] {
    const { tiles, width, height } = this
    const atBottom = ty === height - 1
    const atTop = ty === 0
    // Alternate which side is favored (and, more importantly, which side
    // absorbs any indivisible remainder mass in chunkInteger) so displacement
    // doesn't systematically drift one direction over many ticks — mirrors
    // the leftFirst convention used by the normal horizontal flow/equalize passes.
    const leftFirst = this.leftFirst
    const dx0 = leftFirst ? -1 : 1
    const dx1 = leftFirst ? 1 : -1
    const canA = leftFirst ? tx > 0 : tx < width - 1
    const canB = leftFirst ? tx < width - 1 : tx > 0

    if (!atBottom) {
      const b = idx + width
      if (!exclude.has(b)) {
        const snt = matterType(tiles[b])
        if (snt === type || snt === EMPTY) {
          out.push(b)
        }
      }
      if (canA) {
        const nIdx = b + dx0
        if (!exclude.has(nIdx)) {
          const nt = matterType(tiles[nIdx])
          if (nt === type || nt === EMPTY) {
            out.push(nIdx)
          }
        }
      }
      if (canB) {
        const nIdx = b + dx1
        if (!exclude.has(nIdx)) {
          const nt = matterType(tiles[nIdx])
          if (nt === type || nt === EMPTY) {
            out.push(nIdx)
          }
        }
      }
    }
    if (canA) {
      const nIdx = idx + dx0
      if (!exclude.has(nIdx)) {
        const nt = matterType(tiles[nIdx])
        if (nt === type || nt === EMPTY) {
          out.push(nIdx)
        }
      }
    }
    if (canB) {
      const nIdx = idx + dx1
      if (!exclude.has(nIdx)) {
        const nt = matterType(tiles[nIdx])
        if (nt === type || nt === EMPTY) {
          out.push(nIdx)
        }
      }
    }
    if (!atTop) {
      const a = idx - width
      if (!exclude.has(a)) {
        const nt = matterType(tiles[a])
        if (nt === type || nt === EMPTY) {
          out.push(a)
        }
      }
      if (canA) {
        const nIdx = a + dx0
        if (!exclude.has(nIdx)) {
          const nt = matterType(tiles[nIdx])
          if (nt === type || nt === EMPTY) {
            out.push(nIdx)
          }
        }
      }
      if (canB) {
        const nIdx = a + dx1
        if (!exclude.has(nIdx)) {
          const nt = matterType(tiles[nIdx])
          if (nt === type || nt === EMPTY) {
            out.push(nIdx)
          }
        }
      }
    }
    return out
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
    const selfType = matterType(this.tiles[idx])
    // consumeLiquidFill must run before the overwrite below — it reads tiles[loc] to know what's
    // being destroyed (including releasing any reserved destroy-charge), and once tiles[loc] is
    // set to selfType that information is gone.
    if (isLiquid(intoType) && !isLiquid(selfType)) {
      this.consumeLiquidFill(loc)
      this.notifySolidCreated()
    }
    this.tiles[loc] = selfType
    const lx = loc % this.width
    const ly = loc / this.width | 0
    this.markDirty(lx, ly)
    this.next.add(loc)
    return true
  }

  // Zero liquid fill at idx and track the consumed amount for the conservation check. Safe to
  // call on non-liquid tiles (fill is already 0, nothing tracked).
  //
  // Also the single choke point for releasing reserved destroy-charge (lava/acid): every code
  // path that permanently destroys a tile's mass — destroyTile, fire/burn conversions, growth
  // overwrites, the tryFillFlow zombie-cleanup — funnels through here, so this is the one place
  // that needs to know about reservations rather than each of those call sites separately. The
  // release is fill-unit denominated (reserveDestroyAmount * fill, matching how the reservation
  // was made) so it stays exact regardless of how fill-flow fragmented the original tile across
  // multiple physical cells — the released total is always exactly the fill actually consumed,
  // never a fixed per-tile amount. Non-liquid reserved types (lava-drop) have no fill state and
  // are always destroyed whole, so they use FILL_MAX as their effective fill.
  //
  // Capped at FILL_MAX: column compression (see FILL_COMPRESSION_FACTOR) can push a single
  // cell's fill slightly above FILL_MAX, but the reservation was only ever made for FILL_MAX
  // per placed tile — releasing the raw (possibly compressed) fill over-releases against the
  // reserved pool and eventually underflows it (SimMatterTanks.releaseDestroyCharge warning).
  //
  // releaseReservation=false is for mass-preserving transitions (lava → lava-drop projectile,
  // lava sinking through steam) where this tile's contents move/repackage into a different
  // tile or type rather than being destroyed — the reservation must stay live for whichever
  // tile ends up holding that mass, or it gets released here while nothing was ever destroyed,
  // then released *again* (or attempted) whenever the mass is eventually genuinely destroyed —
  // underflowing the pool for an amount that was already spent.
  consumeLiquidFill(idx: number, releaseReservation = true) {
    const raw = this.tiles[idx]
    const t = matterType(raw)
    if (releaseReservation && RESERVED_DESTROY_CHARGE.has(t)) {
      const effectiveFill = isLiquid(t) ? Math.min(this.fill[idx], FILL_MAX) : FILL_MAX
      if (effectiveFill > 0) {
        this.queueReservationRelease(getOwner(raw), getReserveDestroyAmount(t) * effectiveFill)
      }
    }
    const f = this.fill[idx]
    if (f > 0) this.liquidFillConsumed += f
    this.fill[idx] = 0
  }

  // Track that FILL_MAX liquid fill was created at a new liquid tile.
  notifyLiquidCreated() {
    this.liquidFillCreated += FILL_MAX
  }

  // Track that a solid tile was removed from the domain without a tank credit.
  notifySolidConsumed() {
    this.solidTilesConsumed++
  }

  // Track that a solid tile was added to the domain without a tank debit.
  notifySolidCreated() {
    this.solidTilesCreated++
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
      this.consumeLiquidFill(cidx)
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
    this.consumeLiquidFill(idx)
    this.tiles[idx] = EMPTY
    // Only bump collGen if the destroyed tile was actually contributing to the
    // terrain collision mesh. Shared by both solid destruction (projectiles,
    // brush erase, acid dissolving terrain — needs the real bump) and liquid
    // cleanup (tryFillFlow's zero-fill zombie tiles — never collidable, was
    // firing thousands of wasted terrain-body rebuilds per session).
    if (alwaysCollides(t) || (collidesWhenSettled(t) && isSettled(raw))) {
      this.markDirty(x, y)
    } else {
      this.markRenderDirty(x, y)
    }
    this.next.add(idx)
    if (getSupportType(raw) >= SupportType.STRUCTURAL) {
      this.structuralRemovals.push(idx)
    }
  }

  queueMatterCredit(tx: number, ty: number, ownerId: MatterTankId) {
    const idx = ty * this.width + tx
    const fill = isLiquid(matterType(this.tiles[idx])) ? this.fill[idx] : 0
    this.matterTankCredits.queueCredit(tx, ty, ownerId, fill)
  }

  queueMatterCreditFromTile(tx: number, ty: number, idx: number) {
    const raw = this.tiles[idx]
    const fill = isLiquid(matterType(raw)) ? this.fill[idx] : 0
    this.matterTankCredits.queueCredit(tx, ty, getOwner(raw), fill)
  }

  queueReservationRelease(ownerId: MatterTankId, amount: number) {
    if (amount === 0) return
    this.matterReservationReleases.queueRelease(ownerId, amount)
  }

  doPowderFall(tx: number, ty: number, idx: number) {
    if (ENABLE_MATTER_SIM_PROFILING) {
      this._profDoPowderFallCalls++
      if ((this._profDoPowderFallCalls & MatterSim.PROF_SAMPLE_MASK) === 0) {
        const t0 = performance.now()
        const result = this._doPowderFallImpl(tx, ty, idx)
        this._profDoPowderFallTime += performance.now() - t0
        this._profDoPowderFallSamples++
        return result
      }
    }
    return this._doPowderFallImpl(tx, ty, idx)
  }

  private _doPowderFallImpl(tx: number, ty: number, idx: number) {
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
    if (ENABLE_MATTER_SIM_PROFILING) this._profDoFillTransferCalls++
    const flow = Math.round(amount)
    if (flow <= 0) return
    const wasEmpty = this.fill[toIdx] === 0
    this.fill[fromIdx] -= flow
    this.fill[toIdx] += flow

    if (this.fill[fromIdx] < 1) {
      this.fill[fromIdx] = 0
      this.tiles[fromIdx] = EMPTY
      this.markRenderDirty(fromTx, fromTy)
      this.reactivateAround(fromTx, fromTy)
    } else {
      this.tiles[fromIdx] = setSettled(this.tiles[fromIdx], false)
      this.markRenderDirty(fromTx, fromTy)
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
        this.markRenderDirtyRaw(belowFromIdx)
        this.next.add(belowFromIdx)
      }
    }

    if (wasEmpty) {
      this.tiles[toIdx] = liquidRaw
    } else {
      this.tiles[toIdx] = setSettled(this.tiles[toIdx], false)
    }
    this.markRenderDirty(toTx, toTy)
    this.next.add(toIdx)
  }

  private setFill(
    toIdx: number, toTx: number, toTy: number,
    amount: number,
    liquidRaw: number,
  ): void {
    const flow = Math.round(amount)
    if (flow <= 0) return
    const wasEmpty = this.fill[toIdx] === 0
    this.fill[toIdx] += flow

    if (wasEmpty) {
      this.tiles[toIdx] = liquidRaw
    } else {
      this.tiles[toIdx] = setSettled(this.tiles[toIdx], false)
    }
    this.markRenderDirty(toTx, toTy)
    this.next.add(toIdx)
  }

  // Returns how much fill the lower of two stacked cells should hold.
  // Yields > FILL_MAX when total > FILL_MAX, creating a small compression
  // that drives upward pressure flow (U-tube equalization).
  // Result is always rounded to an integer to preserve exact conservation.
  //
  // Capped at FILL_MAX + compress (~261) regardless of how large `total` gets.
  // Previously the total >= 2*FILL_MAX+compress branch returned total/2 —
  // unbounded in `total`, so a tall column's repeated pairwise stacking
  // (each cell's total feeding the next cell's total below it) compounded
  // into a runaway hydrostatic gradient instead of the "small" compression
  // this function is documented to produce: a 50-tile column measured fill
  // climbing linearly from 225 at the top to 389 at the bottom, all "stable"
  // by that formula. Capping here forces any real excess above the ceiling
  // to show up as positive `want` in the upward-pressure step and horizontal
  // equalization instead of being silently absorbed as a new equilibrium.
  private static getStableState(total: number): number {
    const compress = FILL_MAX * FILL_COMPRESSION_FACTOR
    if (total <= FILL_MAX) return FILL_MAX
    if (total < 2 * FILL_MAX + compress)
      return Math.round((FILL_MAX * FILL_MAX + total * compress) / (FILL_MAX + compress))
    return Math.round(FILL_MAX + compress)
  }

  tryFillFlow(tx: number, ty: number, idx: number, canExpandToEmpty = true, clump = false): boolean {
    if (ENABLE_MATTER_SIM_PROFILING) {
      this._profTryFillFlowCalls++
      if ((this._profTryFillFlowCalls & MatterSim.PROF_SAMPLE_MASK) === 0) {
        const t0 = performance.now()
        const result = this._tryFillFlowImpl(tx, ty, idx, canExpandToEmpty, clump)
        this._profTryFillFlowTime += performance.now() - t0
        this._profTryFillFlowSamples++
        return result
      }
    }
    return this._tryFillFlowImpl(tx, ty, idx, canExpandToEmpty, clump)
  }

  private _tryFillFlowImpl(tx: number, ty: number, idx: number, canExpandToEmpty: boolean, clump: boolean): boolean {
    const { tiles, fill, width, height } = this

    const mass = fill[idx]
    if (mass <= 0) return false

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
          if (remaining <= 0) return true
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
    // has higher myCP than a shorter neighbor at the same y, so interior tiles
    // in a pile also drive flow outward — not just the single outermost edge tile.
    const ax = tx + (this.leftFirst ? -1 : 1)
    const bx = tx + (this.leftFirst ? 1 : -1)
    const myCP = remaining + this.colPressureAbove(tx, ty, type)

    // Pre-scan both neighbours so hasDrain is known before computing wants.
    // Clumping yields entirely to any reachable drain so the full budget flows
    // off the surface rather than being split with same-type consolidation.
    let aIdx = -1, aType = EMPTY, aIsLedge = false, aIsSlopeStep = false
    if (ax >= 0 && ax < width) {
      aIdx = ty * width + ax
      aType = matterType(tiles[aIdx])
      if (aType === EMPTY) {
        aIsLedge = (ty + 1 < height) && matterType(tiles[aIdx + width]) === EMPTY
        if (!aIsLedge) {
          for (let dy = 2; dy <= 8 && ty + dy < height; dy++) {
            if (matterType(tiles[aIdx + dy * width]) === EMPTY) {
              aIsSlopeStep = true
              break
            }
          }
        }
      }
    }
    let bIdx = -1, bType = EMPTY, bIsLedge = false, bIsSlopeStep = false
    if (bx >= 0 && bx < width) {
      bIdx = ty * width + bx
      bType = matterType(tiles[bIdx])
      if (bType === EMPTY) {
        bIsLedge = (ty + 1 < height) && matterType(tiles[bIdx + width]) === EMPTY
        if (!bIsLedge) {
          for (let dy = 2; dy <= 8 && ty + dy < height; dy++) {
            if (matterType(tiles[bIdx + dy * width]) === EMPTY) {
              bIsSlopeStep = true
              break
            }
          }
        }
      }
    }
    const hasDrain = (aIdx !== -1 && aType === EMPTY && (aIsLedge || aIsSlopeStep))
      || (bIdx !== -1 && bType === EMPTY && (bIsLedge || bIsSlopeStep))

    let wantA = 0
    if (aIdx !== -1) {
      if (aType === type) {
        // Same-type: clump (donate fill) unless a drain is reachable — when draining,
        // suppress same-type flow entirely so the full budget exits the surface.
        if (!hasDrain) {
          wantA = (clump && remaining < FILL_MAX)
            ? (fill[aIdx] + remaining <= FILL_MAX ? remaining : Math.max(0, FILL_MAX - fill[aIdx]))
            : Math.round(Math.max(0, (myCP - fill[aIdx] - this.colPressureAbove(ax, ty, type)) / FILL_PRESSURE_DIVISOR))
        }
      } else if (aType === EMPTY && (canExpandToEmpty || aIsLedge || aIsSlopeStep)) {
        wantA = aIsLedge
          ? remaining
          : Math.round(Math.max(0, (myCP - this.colPressureAbove(ax, ty, type)) / FILL_PRESSURE_DIVISOR))
      }
    }

    let wantB = 0
    if (bIdx !== -1) {
      if (bType === type) {
        if (!hasDrain) {
          wantB = (clump && remaining < FILL_MAX)
            ? (fill[bIdx] + remaining <= FILL_MAX ? remaining : Math.max(0, FILL_MAX - fill[bIdx]))
            : Math.round(Math.max(0, (myCP - fill[bIdx] - this.colPressureAbove(bx, ty, type)) / FILL_PRESSURE_DIVISOR))
        }
      } else if (bType === EMPTY && (canExpandToEmpty || bIsLedge || bIsSlopeStep)) {
        wantB = bIsLedge
          ? remaining
          : Math.round(Math.max(0, (myCP - this.colPressureAbove(bx, ty, type)) / FILL_PRESSURE_DIVISOR))
      }
    }

    const totalWant = wantA + wantB
    if (totalWant > 0) {
      const budget = Math.min(remaining, totalWant)
      // Compute A's share via floor; B gets the remainder to guarantee fA+fB=budget exactly.
      const fA = (wantA > 0 && wantB > 0) ? Math.floor(budget * wantA / totalWant) : (wantA > 0 ? budget : 0)
      const fB = budget - fA
      if (fA > 0) {
        this.doFillTransfer(idx, tx, ty, aIdx, ax, ty, fA, liquidRaw)
        remaining -= fA
        moved = true
      }
      if (fB > 0) {
        this.doFillTransfer(idx, tx, ty, bIdx, bx, ty, fB, liquidRaw)
        remaining -= fB
        moved = true
      }
    }

    if (remaining <= 0) {
      // Donated every fill unit to neighbours — tile is now a zero-fill zombie.
      // Destroy immediately so adjacent tiles never see it as a living neighbour.
      this.destroyTile(tx, ty, idx)
      this.reactivateAround(tx, ty)
      return true
    }

    // Zombie cleanup: fill too small to drive flow via the pressure formula gets
    // stranded on surfaces forever. Consume it via the liquid delta so the
    // conservation tracker stays balanced (liquidNetDelta -= remaining).
    if (!moved && remaining <= FILL_ROUND_TO_ZERO) {
      this.consumeLiquidFill(idx)
      this.tiles[idx] = EMPTY
      this.markRenderDirty(tx, ty)
      this.reactivateAround(tx, ty)
      return true
    }

    // ── 3. Upward pressure ───────────────────────────────────────────────────
    // Push excess above FILL_MAX upward. Wakeup propagates the cascade over
    // multiple sub-steps so U-tube arms equalize within a single rendered frame.
    if (remaining > FILL_MAX && ty > 0) {
      const upIdx = idx - width
      const upType = matterType(tiles[upIdx])
      if (upType === EMPTY || upType === type) {
        const want = remaining - MatterSim.getStableState(remaining + fill[upIdx])
        if (want > 0) {
          const flow = Math.min(want, remaining - FILL_MAX)
          this.doFillTransfer(idx, tx, ty, upIdx, tx, ty - 1, flow, liquidRaw)
          moved = true
        }
      }
    }

    return moved
  }

  private _tryFillDisplaceNeighbors: number[] = []
  private _tryFillDisplaceFillSpread: number[] = []

  doFillDisplace(tx: number, ty: number, idx: number, exclude: Set<number>, activeSet: TileSet) {
    const width = this.width
    const fill = this.fill
    exclude.add(idx)
    const mass = fill[idx]
    if (mass <= 0) return false
    const tiles = this.tiles
    let moved = false

    const fromRaw = tiles[idx]
    const type = matterType(fromRaw)
    // Unsettle so the destination is re-evaluated on the next sim pass instead
    // of inheriting a stale settled flag from the source tile.
    const liquidRaw = setSettled(fromRaw, false)

    this._tryFillDisplaceNeighbors.length = 0
    const neighbors = this.getBorderingAdjacentTypeOrEmpty(tx, ty, idx, type, exclude, this._tryFillDisplaceNeighbors)
    if (neighbors.length < 1) {
      return false
    }
    const fillsToSpread = chunkInteger(mass, neighbors.length, this._tryFillDisplaceFillSpread)

    for (let i = 0; i < fillsToSpread.length; i++) {
      const flow = fillsToSpread[i]
      const nIdx = neighbors[i]
      exclude.add(nIdx)
      if (flow <= 0) continue

      // Coordinates of the destination tile, not the source tile being vacated.
      const nx = nIdx % width
      const ny = (nIdx / width) | 0

      this.setFill(nIdx, nx, ny, flow, liquidRaw)
      // setFill only tracks the tile in this MatterSim's own `next` set, which
      // the coordinator's local sim instance never drains — add it to the real
      // active set explicitly so the displaced liquid keeps simulating instead
      // of freezing in place (e.g. hanging unsupported in the air).
      activeSet.add(nIdx)
      moved = true
    }

    this.fill[idx] = 0
    this.tiles[idx] = EMPTY
    this.markRenderDirty(tx, ty)
    this.reactivateAround(tx, ty, activeSet)

    // Wake settled liquid directly below the sender — it may be pressurized and
    // waiting to push upward now that this tile has emptied.
    if (ty < this.height - 1) {
      const belowFromIdx = idx + width
      const belowRaw = tiles[belowFromIdx]
      if (isLiquid(matterType(belowRaw)) && isSettled(belowRaw)) {
        tiles[belowFromIdx] = setSettled(belowRaw, false)
        this.markRenderDirtyRaw(belowFromIdx)
        activeSet.add(belowFromIdx)
      }
    }

    return moved
  }

  // Takes the current active set, sorts it by y descending (bottommost first),
  // and for each overfull liquid cell pushes excess upward in-place. Because
  // we process bottom-to-top, a newly overfull cell at y-1 is already next in
  // the sorted list, so the full column cascades in a single pass.
  // Must be called after all worker rounds finish (no concurrent writers).
  doUpwardPressurePass(activeSet: TileSet): void {
    const { tiles, fill, width } = this

    // Bail before the O(n log n) sort below when the active set has no
    // liquid at all (e.g. a falling sand/rock scenario) — the loop would
    // have `continue`d past every single entry anyway. Can't pre-filter the
    // list itself: a cell that starts EMPTY (not liquid) can be converted to
    // liquid mid-pass by receiving flow from below (the `upType === EMPTY`
    // branch below), and must still be eligible to cascade further up later
    // in this same sorted iteration — pre-filtering by isLiquid/overfull
    // would silently drop that case and truncate multi-level cascades.
    let hasLiquid = false
    for (const idx of activeSet) {
      if (idx >= width && isLiquid(matterType(tiles[idx]))) {
        hasLiquid = true
        break
      }
    }
    if (!hasLiquid) return

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
      if (want <= 0) continue
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
      this.markRenderDirty(tx, ty - 1)
      this.markRenderDirty(tx, ty)
      activeSet.add(upIdx)
      activeSet.add(idx)
    }
  }
}

function isSolid(value: number) {
  return getSupportType(value) > SupportType.NONE || isSettled(value)
}

function chunkInteger(total: number, numParts: number, out: number[]): number[] {
  if (numParts <= 0) throw new Error('numParts must be greater than 0')

  const base = (total / numParts) | 0
  const remainder = total % numParts
  out.length = numParts

  for (let i = 0; i < remainder; i++) {
    out[i] = base + 1
  }

  for (let i = remainder; i < numParts; i++) {
    out[i] = base
  }

  return out
}