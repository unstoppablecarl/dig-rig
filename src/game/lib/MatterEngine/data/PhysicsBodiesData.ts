import type { RectVerts } from '../../Collision/_Collision.types.ts'
import type { PhysicsBody } from '../../Collision/PhysicsBody.ts'
import { type Buffers, makeSOABuffers, type Schema, soaBuffersToViews } from '../../Util/StructOfArrays.ts'

const SCHEMA = {
  status: Uint8Array,

  v1x: Float32Array,
  v1y: Float32Array,

  v2x: Float32Array,
  v2y: Float32Array,

  v3x: Float32Array,
  v3y: Float32Array,

  v4x: Float32Array,
  v4y: Float32Array,

  deltaX: Float32Array,
  deltaY: Float32Array,

  // Wrapping counter, main-thread-only writer, bumped (Atomics.store, after
  // verts/delta are written) on every syncFromBody. Lets the coordinator tell
  // a fresh sync from one it already consumed — a body at rest stops syncing,
  // and without this its last delta stayed in the buffer and got re-swept
  // (re-displacing liquid along the old path) every coordinator tick.
  syncSeq: Uint8Array,

  // Coordinator-only writer: the syncSeq of the last sync rasterize() consumed.
  // The main thread (PhysicsBody.ts) re-anchors to the position it reported
  // with THAT sync, so deltaX/deltaY are always cumulative displacement since
  // exactly what the coordinator last swept — no gap and no overlap, however
  // many main-thread frames pass between coordinator ticks.
  consumedSeq: Uint8Array,
} as const satisfies Schema

export type PhysicsBodiesSchema = typeof SCHEMA
export type PhysicsBodiesBuffers = Buffers<PhysicsBodiesSchema>

export const MAX_PHYSICS_BODIES = 256

export enum PhysicsBodyStatus {
  INACTIVE,
  ACTIVE,
  PENDING,
  DESTROYED
}

// only used for transporting draw data for particles
export class PhysicsBodiesData {
  readonly status: Uint8Array

  readonly v1x: Float32Array
  readonly v1y: Float32Array

  readonly v2x: Float32Array
  readonly v2y: Float32Array

  readonly v3x: Float32Array
  readonly v3y: Float32Array

  readonly v4x: Float32Array
  readonly v4y: Float32Array

  readonly deltaX: Float32Array
  readonly deltaY: Float32Array
  readonly syncSeq: Uint8Array
  readonly consumedSeq: Uint8Array

  private readonly _freeSlots: number[] = Array.from({ length: MAX_PHYSICS_BODIES }, (_, i) => i)

  static makeBuffers(): PhysicsBodiesBuffers {
    return makeSOABuffers(SCHEMA, MAX_PHYSICS_BODIES)
  }

  constructor(readonly buffers: PhysicsBodiesBuffers) {
    const views = soaBuffersToViews(SCHEMA, buffers)

    this.status = views.status
    this.v1x = views.v1x
    this.v1y = views.v1y

    this.v2x = views.v2x
    this.v2y = views.v2y

    this.v3x = views.v3x
    this.v3y = views.v3y

    this.v4x = views.v4x
    this.v4y = views.v4y

    this.deltaX = views.deltaX
    this.deltaY = views.deltaY
    this.syncSeq = views.syncSeq
    this.consumedSeq = views.consumedSeq
  }

  acquire(): number {
    return this._freeSlots.pop() ?? -1
  }

  release(slotIdx: number) {
    if (slotIdx < 0) return
    if (this.status[slotIdx] === PhysicsBodyStatus.INACTIVE) {
      console.error(`ProjectileManagerData: double-release of slot ${slotIdx}`)
      return
    }
    this.status[slotIdx] = PhysicsBodyStatus.INACTIVE
    this._freeSlots.push(slotIdx)
  }

  registerPending(b: PhysicsBody) {
    this.status[b.slotIdx] = PhysicsBodyStatus.PENDING
  }

  // Main-thread-only. Returns the new syncSeq for this sync.
  syncFromBody(idx: number, dx: number, dy: number, [v1, v2, v3, v4]: RectVerts): number {
    this.v1x[idx] = v1.x
    this.v1y[idx] = v1.y

    this.v2x[idx] = v2.x
    this.v2y[idx] = v2.y

    this.v3x[idx] = v3.x
    this.v3y[idx] = v3.y

    this.v4x[idx] = v4.x
    this.v4y[idx] = v4.y

    this.deltaX[idx] = dx
    this.deltaY[idx] = dy

    this.status[idx] = PhysicsBodyStatus.ACTIVE

    // Published last, so a coordinator that sees the new seq also sees the data above.
    const seq = (Atomics.load(this.syncSeq, idx) + 1) & 0xFF
    Atomics.store(this.syncSeq, idx, seq)
    return seq
  }

  getSyncSeq(idx: number): number {
    return Atomics.load(this.syncSeq, idx)
  }

  destroy(idx: number) {
    this.status[idx] = PhysicsBodyStatus.DESTROYED
  }

  getDelta(slotIdx: number, out: { x: number, y: number }) {
    out.x = this.deltaX[slotIdx]
    out.y = this.deltaY[slotIdx]

    return out
  }

  // Coordinator-only: call once rasterize() has finished consuming the sync
  // with this seq (see consumedSeq).
  markConsumed(slotIdx: number, seq: number): void {
    Atomics.store(this.consumedSeq, slotIdx, seq)
  }

  getConsumedSeq(slotIdx: number): number {
    return Atomics.load(this.consumedSeq, slotIdx)
  }

  getPoints(slotIdx: number, out: RectVerts) {

    out[0].x = this.v1x[slotIdx]
    out[0].y = this.v1y[slotIdx]

    out[1].x = this.v2x[slotIdx]
    out[1].y = this.v2y[slotIdx]

    out[2].x = this.v3x[slotIdx]
    out[2].y = this.v3y[slotIdx]

    out[3].x = this.v4x[slotIdx]
    out[3].y = this.v4y[slotIdx]

    return out
  }

  isActive(idx: number) {
    return this.status[idx] === PhysicsBodyStatus.ACTIVE
  }
}
