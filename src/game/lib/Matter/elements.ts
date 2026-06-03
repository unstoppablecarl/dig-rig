import type { MatterType } from './_Matter-types.ts'
import type { MatterWorld } from './MatterWorld.ts'

export type ElementAction = (world: MatterWorld, x: number, y: number, idx: number, next: Set<number>) => void

export type ElementDef = {
  name: string,
  id: MatterType,
  action?: ElementAction,
  passive?: boolean,
  lavaImmune?: boolean,
  acidImmune?: boolean,
  liquid?: boolean,
  sinksThrough?: MatterType[],
}

const noop = () => {
}

export const ELEMENT_ACTIONS: ElementAction[] = []
export const PASSIVE_ELEMENTS = new Set<MatterType>()
export const ELEMENT_NAMES = new Map<MatterType, string>()
export const LAVA_IMMUNE = new Set<MatterType>()
export const ACID_IMMUNE = new Set<MatterType>()

export const LIQUID_TYPES = new Set<MatterType>()
export const SINKS_THROUGH: Partial<Record<MatterType, MatterType[]>> = {}

function add({
               id,
               name,
               action = noop,
               passive = false,
               lavaImmune = false,
               acidImmune = false,
               liquid = false,
               sinksThrough,
             }: ElementDef) {

  ELEMENT_ACTIONS[id] = action
  ELEMENT_NAMES.set(id, name)

  if (passive) {
    PASSIVE_ELEMENTS.add(id)
  }
  if (lavaImmune) {
    LAVA_IMMUNE.add(id)
  }
  if (acidImmune) {
    ACID_IMMUNE.add(id)
  }
  if (liquid) {
    LIQUID_TYPES.add(id)
  }
  if (sinksThrough) {
    SINKS_THROUGH[id] = sinksThrough
  }
  return id
}

const modules = import.meta.glob('./elements/*.ts', { eager: true }) as Record<string, { default: ElementDef }>
for (const path in modules) {
  add(modules[path].default)
}