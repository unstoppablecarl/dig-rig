import { MatterType, MatterTypeValues } from '../_Matter.types'

export class MatterTypeSet {
  // TypeMask — 256-bit bitmask over MatterType values (8 × Uint32, 32 bytes).
  // Supports up to 256 distinct types; each type t occupies bit (t & 31) of word (t >>> 5).
  private readonly _mask = new Uint32Array(8)

  constructor(
    ...types: MatterType[]
  ) {
    for (const t of types) this.add(t)
  }

  add(type: MatterType): void {
    // (type & 31) same as: type % 32
    // similar to: const a = new Array(32).fill(0); a[type % 32] = 1
    const lookupMask = 1 << (type & 31)
    // same as: const index = Math.floor(t / 32)
    const index = type >>> 5
    // merge
    this._mask[index] |= lookupMask
  }

  has(type: MatterType): boolean {
    // (type & 31) same as: type % 32
    // similar to: const a = new Array(32).fill(0); a[type % 32] = 1
    const lookupMask = 1 << (type & 31)
    // same as: const index = Math.floor(t / 32)
    const index = type >>> 5
    return (this._mask[index] & lookupMask) !== 0
  }

  merge(other: MatterTypeSet): MatterTypeSet {
    const result = new MatterTypeSet()
    for (let i = 0; i < 8; i++) {
      result._mask[i] = this._mask[i] | other._mask[i]
    }
    return result
  }
}

export function matterTypeSetExcluding(exclude: MatterType[]): MatterTypeSet {
  return new MatterTypeSet(...MatterTypeValues.filter(v => !exclude.includes(v)))
}