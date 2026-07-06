import { getOwner, matterType, MatterType } from '../../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'

// fill > 0 → liquid credit (add fill units to liquidMatter); fill = 0 → solid credit (+1 to solid tank)
const STRIDE = 4

export class MatterCreditTransferBuffer {
  private _data = new Int32Array(256 * STRIDE)
  private _len = 0

  constructor(private tiles: Uint32Array) {
  }

  queueCredit(tx: number, ty: number, ownerId: MatterTankId, fill = 0) {
    const needed = this._len + STRIDE
    if (needed > this._data.length) {
      const bigger = new Int32Array(this._data.length * 2)
      bigger.set(this._data)
      this._data = bigger
    }
    this._data[this._len++] = tx
    this._data[this._len++] = ty
    this._data[this._len++] = ownerId
    this._data[this._len++] = fill
  }

  queueCreditFromTile(tx: number, ty: number, idx: number) {
    const ownerId = getOwner(this.tiles[idx])
    if (!ownerId) {
      const label = MatterType[matterType(this.tiles[idx] as MatterType)]
      throw new Error('no owner found for: ' + label)
    }
    this.queueCredit(tx, ty, ownerId)
  }

  private static _empty = new Int32Array(0)

  flush(): Int32Array {
    const len = this._len
    if (len === 0) return MatterCreditTransferBuffer._empty
    const buf = this._data.buffer
    this._data = new Int32Array(Math.max(256 * STRIDE, len))
    this._len = 0
    return new Int32Array(buf, 0, len)
  }

  static readBuffer(data: Int32Array, cb: (tx: number, ty: number, ownerId: MatterTankId, fill: number) => void) {
    for (let i = 0; i < data.length; i += STRIDE) {
      const tx = data[i]
      const ty = data[i + 1]
      const ownerId = data[i + 2] as MatterTankId
      const fill = data[i + 3]
      cb(tx, ty, ownerId, fill)
    }
  }
}