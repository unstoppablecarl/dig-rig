import { type MatterTankId, NO_MATTER_TANK_ID } from '../../../Matter/Tank/_MatterTank.types.ts'
import type { ParticleType } from '../../../Particles/_particle-types.ts'

const INITIAL_CAPACITY = 64 * 4

export class ParticleSpawnBuffer {
  private buf = new Int32Array(INITIAL_CAPACITY)
  private len = 0

  push(type: ParticleType, x: number, y: number, ownerId: MatterTankId | undefined) {
    if (this.len + 4 > this.buf.length) {
      const bigger = new Int32Array(this.buf.length * 2)
      bigger.set(this.buf)
      this.buf = bigger
    }
    this.buf[this.len++] = type
    this.buf[this.len++] = x
    this.buf[this.len++] = y
    this.buf[this.len++] = ownerId ?? NO_MATTER_TANK_ID
  }

  // Returns the pending batch and resets. The caller is responsible for transferring
  // the underlying ArrayBuffer. Returns null if nothing was queued.
  flush(): Int32Array | null {
    if (this.len === 0) return null
    const len = this.len
    const buf = this.buf.buffer
    this.buf = new Int32Array(Math.max(INITIAL_CAPACITY, len))
    this.len = 0
    return new Int32Array(buf, 0, len)
  }

  static readBuffer(data: Int32Array, cb: (type: ParticleType, x: number, y: number, ownerId: MatterTankId) => void) {
    for (let i = 0; i < data.length; i += 4) {
      const type = data[i] as ParticleType
      let x = data[i + 1]
      let y = data[i + 2]
      let ownerId = data[i + 3] as MatterTankId
      cb(type, x, y, ownerId)
    }
  }
}
