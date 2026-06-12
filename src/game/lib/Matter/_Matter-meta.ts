import { EMPTY, isStructuralFlag, MatterType, matterType, MatterTypeSet, setStructuralFlag } from './_Matter.types'

export const PASSIVE_MATER_TYPES = new MatterTypeSet()
export const LAVA_IMMUNE = new MatterTypeSet()
export const ACID_IMMUNE = new MatterTypeSet()
export const COLLIDES_WHEN_SETTLED = new MatterTypeSet()
export const LIQUID_TYPES = new MatterTypeSet()
export const SINKS_THROUGH: Partial<Record<MatterType, MatterTypeSet>> = {}

// Types that are always structural (structural: true in MatterDef).
export const ALWAYS_STRUCTURAL = new MatterTypeSet()
// Maps structural types to the type they convert to on island collapse (undefined = keep same type).
export const STRUCTURAL_COLLAPSE_TO: Partial<Record<MatterType, MatterType>> = {}

// True if this raw tile value participates in structural island detection:
// either its type is always-structural, or it has STRUCTURAL_FLAG set (per-tile opt-in).
export function isStructural(raw: number): boolean {
  return ALWAYS_STRUCTURAL.has(matterType(raw)) || isStructuralFlag(raw)
}

export function setStructural(target: number, value: boolean): number {
  if (import.meta.env.DEV) {
    const type = matterType(target)
    if (type === EMPTY || ALWAYS_STRUCTURAL.has(type)) {
      throw new Error(`Cannot set ${MatterType[type]} structural flag it is immutable.`)
    }
  }
  return setStructuralFlag(target, value)
}