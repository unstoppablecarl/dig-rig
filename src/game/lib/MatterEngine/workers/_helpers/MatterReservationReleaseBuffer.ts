import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'

const STRIDE = 2

// Per-MatterSim-worker, transferable — mirrors MatterCreditTransferBuffer.
// Lets lava/acid self-destruct rules (running inside MatterSim worker threads)
// release reserved destroy-charge on the Coordinator-side SimMatterTanks,
// which they have no direct access to.
export class MatterReservationReleaseBuffer {
  private _data = new Int32Array(256 * STRIDE)
  private _len = 0

  queueRelease(ownerId: MatterTankId, amount: number) {
    const needed = this._len + STRIDE
    if (needed > this._data.length) {
      const bigger = new Int32Array(this._data.length * 2)
      bigger.set(this._data)
      this._data = bigger
    }
    this._data[this._len++] = ownerId
    this._data[this._len++] = amount
  }

  private static _empty = new Int32Array(0)

  flush(): Int32Array {
    const len = this._len
    if (len === 0) return MatterReservationReleaseBuffer._empty
    const buf = this._data.buffer
    this._data = new Int32Array(Math.max(256 * STRIDE, len))
    this._len = 0
    return new Int32Array(buf, 0, len)
  }

  static readBuffer(data: Int32Array, cb: (ownerId: MatterTankId, amount: number) => void) {
    for (let i = 0; i < data.length; i += STRIDE) {
      const ownerId = data[i] as MatterTankId
      const amount = data[i + 1]
      cb(ownerId, amount)
    }
  }
}
