import { MAX_PARTICLES } from '../../../config.ts'
import { EMPTY, type MatterValue } from '../../Matter/_Matter.types.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../../Matter/Tank/_MatterTank.types.ts'
import type { ParticleType } from '../../Particles/_particle-types.ts'
import { ringBufferByteLength, RingBufferReader, RingBufferWriter } from '../../Util/RingBuffer.ts'

const SCHEMA = {
  particleType: Uint32Array,
  x: Float32Array,
  y: Float32Array,
  ownerId: Uint32Array,
  vx: Float32Array,
  vy: Float32Array,
  value: Uint32Array,
}

const RING_BYTE_LENGTH = ringBufferByteLength(SCHEMA, MAX_PARTICLES)

// One extra Int32 tacked onto the end of the ring buffer's own bytes, used as a spinlock
// (see queue()) — RING_BYTE_LENGTH is always a multiple of 4 (schema's largest
// element is 4 bytes and MAX_PARTICLES scales it), so this offset is aligned.
const LOCK_OFFSET = RING_BYTE_LENGTH
const BYTE_LENGTH = RING_BYTE_LENGTH + 4

export class ParticleSpawnData {
  private readonly writer: RingBufferWriter<typeof SCHEMA>
  private readonly reader: RingBufferReader<typeof SCHEMA>
  private readonly lock: Int32Array

  static makeBuffer(): SharedArrayBuffer {
    return new SharedArrayBuffer(BYTE_LENGTH)
  }

  constructor(readonly buffer: SharedArrayBuffer) {
    this.writer = new RingBufferWriter(SCHEMA, MAX_PARTICLES, buffer)
    this.reader = new RingBufferReader(SCHEMA, MAX_PARTICLES, buffer)
    this.lock = new Int32Array(buffer, LOCK_OFFSET, 1)
  }

  // Called from multiple concurrent writers — the main thread (weapon fire), the
  // coordinator's own local MatterSim, and every MatterSim pool worker (matter defs like
  // napalm/nitro/thermite call sim.spawnParticle() from tile processing, and multiple pool
  // workers run in parallel per round). RingBufferWriter.write() assumes a single writer
  // (a non-atomic read-then-store of the head), so two concurrent callers could reserve the
  // same slot and one spawn would silently overwrite/corrupt the other. A spinlock (not
  // Atomics.wait, which throws on the main thread) around the whole reserve+write turns that
  // into a mutually-exclusive critical section; contention windows are a handful of field
  // writes so busy-waiting is cheap.
  queue(particleType: ParticleType, x: number, y: number, ownerId: MatterTankId = NO_MATTER_TANK_ID, vx: number = 0, vy: number = 0, value: MatterValue = EMPTY) {
    while (Atomics.compareExchange(this.lock, 0, 0, 1) !== 0) {
      // busy-wait
    }
    try {
      this.writer.write((cursor) => {
        cursor.particleType = particleType
        cursor.x = x
        cursor.y = y
        cursor.ownerId = ownerId
        cursor.value = value
        cursor.vx = vx
        cursor.vy = vy
      })
    } finally {
      Atomics.store(this.lock, 0, 0)
    }
  }

  // Coordinator side — sole reader/drainer.
  drain(callback: (particleType: ParticleType, x: number, y: number, ownerId: MatterTankId, vx: number, vy: number, value: MatterValue) => void) {
    this.reader.drain((cursor) => {
      callback(cursor.particleType, cursor.x, cursor.y, cursor.ownerId as MatterTankId, cursor.vx, cursor.vy, cursor.value)
    })
  }
}
