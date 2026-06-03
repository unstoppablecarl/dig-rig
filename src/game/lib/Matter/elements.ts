import type { MatterType } from './_Matter-types.ts'
import type { MatterWorld } from './MatterWorld.ts'

export type ElementAction = (world: MatterWorld, x: number, y: number, idx: number, next: Set<number>) => void

export type ElementDef = {
  name: string,
  id: MatterType,
  action?: ElementAction,
  passive?: boolean,
}

const noop = () => {
}

export const ELEMENT_ACTIONS: ElementAction[] = []
export const PASSIVE_ELEMENTS = new Set()
export const ELEMENT_NAMES = new Map<MatterType, string>()

function add({
               id,
               name,
               action = noop,
               passive = false,
             }: ElementDef) {

  ELEMENT_ACTIONS[id] = action
  ELEMENT_NAMES.set(id, name)

  if (passive) {
    PASSIVE_ELEMENTS.add(id)
  }

  return id
}

const modules = import.meta.glob('./elements/*.ts', { eager: true }) as Record<string, { default: ElementDef }>
for (const path in modules) {
  add(modules[path].default)
}