import { type MatterType, MatterTypeValues } from '../_Matter.types'

export class MatterTypeSet {
  // TypeMask — 256-bit bitmask over MatterType values (8 × Uint32, 32 bytes).
  // Supports up to 256 distinct types; each type t occupies bit (t & 31) of word (t >>> 5).
  private readonly _mask = new Uint32Array(8)

  static excluding(...exclude: (MatterType | MatterTypeSet)[]): MatterTypeSet {
    return new MatterTypeSet(...MatterTypeValues.filter(v => !exclude.includes(v)))
  }

  constructor(
    ...types: (MatterType | MatterTypeSet)[]
  ) {
    for (const t of types) this.add(t)
  }

  add(type: MatterType | MatterTypeSet) {
    if (type instanceof MatterTypeSet) {
      for (const t of type.toArray()) {
        this.add(t)
      }
      return this
    }
    // (type & 31) same as: type % 32
    // similar to: const a = new Array(32).fill(0); a[type % 32] = 1
    const lookupMask = 1 << (type & 31)
    // same as: const index = Math.floor(t / 32)
    const index = type >>> 5
    // merge
    this._mask[index] |= lookupMask

    return this
  }

  remove(type: MatterType | MatterTypeSet): this {
    if (type instanceof MatterTypeSet) {
      for (const t of type.toArray()) {
        this.remove(t)
      }
      return this
    }
    // (type & 31) same as: type % 32
    // similar to: const a = new Array(32).fill(0); a[type % 32] = 1
    const lookupMask = 1 << (type & 31)
    // same as: const index = Math.floor(type / 32)
    const index = type >>> 5
    this._mask[index] &= ~lookupMask
    return this
  }

  has(type: MatterType): boolean {
    // (type & 31) same as: type % 32
    // similar to: const a = new Array(32).fill(0); a[type % 32] = 1
    const lookupMask = 1 << (type & 31)
    // same as: const index = Math.floor(type / 32)
    const index = type >>> 5

    return (this._mask[index] & lookupMask) !== 0
  }

  toArray(): MatterType[] {
    return MatterTypeValues.filter(v => this.has(v))
  }

  toWebGL(): string {
    return Array.from(this._mask)
      .map((v): string => {
        return `0x${v.toString(16).padStart(8, '0')}u`
      })
      .join(', ')
  }
}