import { type MatterType, MatterTypeSet } from './_Matter-types'

export const PASSIVE_MATER_TYPES = new MatterTypeSet()
export const LAVA_IMMUNE = new MatterTypeSet()
export const ACID_IMMUNE = new MatterTypeSet()
export const COLLIDES_WHEN_SETTLED = new MatterTypeSet()
export const LIQUID_TYPES = new MatterTypeSet()
export const SINKS_THROUGH: Partial<Record<MatterType, MatterTypeSet>> = {}