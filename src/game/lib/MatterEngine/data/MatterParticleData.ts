export type MatterParticleDataBuffers = {
  // 1 = tile idx currently holds a particle. One byte per map tile.
  active: SharedArrayBuffer
  // MatterType the particle was acquired as — see MatterSim.processSubset's stale-flag check.
  type: SharedArrayBuffer
  // Sim frame the particle was last processed (or spawned) on — see isLive.
  seenFrame: SharedArrayBuffer
  vx: SharedArrayBuffer
  vy: SharedArrayBuffer
  fracX: SharedArrayBuffer
  fracY: SharedArrayBuffer
}

// Backing store for tiles promoted to particles (see MatterDef.particleAction). A tile keeps
// its MatterType/owner bits in `tiles[idx]` — this only tracks the extra per-particle float
// state (velocity + sub-tile movement remainder) a normal settled matter tile doesn't need.
//
// Indexed directly by tile idx rather than a separate fixed-capacity slot pool: a particle IS
// a promoted tile, so the tile grid itself is already the hard ceiling on how many can exist
// at once (at most width*height, same as `tiles`). A pool with its own smaller capacity could
// exhaust and silently no-op a spawn — leaving that tile's mass stuck instead of consistently
// becoming a particle or not, a correctness footgun for matter conservation, not a performance
// one — so it's designed out entirely rather than just made generous. This also means no
// cross-worker freelist/lock is needed: acquire/release/move only ever touch the idx (and, for
// move, the destination idx) the calling worker already exclusively owns this round, same
// invariant every other in-round tile move (tryMove, doPowderFall, ...) already relies on.
export class MatterParticleData {
  readonly active: Uint8Array
  readonly type: Uint8Array
  readonly seenFrame: Uint32Array
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly fracX: Float32Array
  readonly fracY: Float32Array

  static makeBuffers(width: number, height: number): MatterParticleDataBuffers {
    const n = width * height
    return {
      active: new SharedArrayBuffer(n * Uint8Array.BYTES_PER_ELEMENT),
      type: new SharedArrayBuffer(n * Uint8Array.BYTES_PER_ELEMENT),
      seenFrame: new SharedArrayBuffer(n * Uint32Array.BYTES_PER_ELEMENT),
      vx: new SharedArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT),
      vy: new SharedArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT),
      fracX: new SharedArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT),
      fracY: new SharedArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT),
    }
  }

  constructor(readonly buffers: MatterParticleDataBuffers) {
    this.active = new Uint8Array(buffers.active)
    this.type = new Uint8Array(buffers.type)
    this.seenFrame = new Uint32Array(buffers.seenFrame)
    this.vx = new Float32Array(buffers.vx)
    this.vy = new Float32Array(buffers.vy)
    this.fracX = new Float32Array(buffers.fracX)
    this.fracY = new Float32Array(buffers.fracY)
  }

  // Promotes tile `idx` (already holding whatever MatterType/owner bits it should keep) to a
  // particle with the given initial velocity. Unlike a pooled acquire, this cannot fail.
  // `type` must be the tile's current MatterType, `frame` the current sim frame (see isLive).
  acquire(idx: number, type: number, vx: number, vy: number, frame: number) {
    this.active[idx] = 1
    this.type[idx] = type
    this.seenFrame[idx] = frame
    this.vx[idx] = vx
    this.vy[idx] = vy
    this.fracX[idx] = 0
    this.fracY[idx] = 0
  }

  // Whether idx holds a genuinely live particle, rather than a flag left behind by code that
  // overwrote/emptied/refilled the tile without going through release/move (CA fill transfers
  // draining it, swaps, physics-body stamping, ...). A live particle re-queues itself every
  // tick, so it's always processed on this frame or the previous one; a leftover flag stops
  // being touched and ages out on its own. The type check alone missed a tile drained empty and
  // later refilled with the same liquid — it passed as live forever, even inside a settled pool,
  // and liquid above it then became particles held behind it indefinitely (never leveling).
  isLive(idx: number, tileType: number, frame: number): boolean {
    return this.active[idx] === 1 && this.type[idx] === tileType && this.seenFrame[idx] + 1 >= frame
  }

  // Marks idx as processed on `frame` — see isLive.
  touch(idx: number, frame: number) {
    this.seenFrame[idx] = frame
  }

  // Converts a particle-flagged tile back into normal matter. The tile's own MatterType/owner
  // bits are untouched; caller decides what they should settle into.
  release(idx: number) {
    this.active[idx] = 0
  }

  // Relocates a particle's tracked velocity/remainder from oldIdx to newIdx — call alongside
  // the matching tiles[]/fill[] move.
  move(oldIdx: number, newIdx: number) {
    this.active[oldIdx] = 0
    this.active[newIdx] = 1
    this.type[newIdx] = this.type[oldIdx]
    this.seenFrame[newIdx] = this.seenFrame[oldIdx]
    this.vx[newIdx] = this.vx[oldIdx]
    this.vy[newIdx] = this.vy[oldIdx]
    this.fracX[newIdx] = this.fracX[oldIdx]
    this.fracY[newIdx] = this.fracY[oldIdx]
  }

  setVelocity(idx: number, vx: number, vy: number) {
    this.vx[idx] = vx
    this.vy[idx] = vy
  }

  setVelocityAngle(idx: number, velocity: number, angle: number) {
    this.vx[idx] = velocity * Math.cos(angle)
    this.vy[idx] = velocity * Math.sin(angle)
  }

  setFrac(idx: number, fracX: number, fracY: number) {
    this.fracX[idx] = fracX
    this.fracY[idx] = fracY
  }
}
