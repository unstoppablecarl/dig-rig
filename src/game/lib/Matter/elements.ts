import type { MatterWorld } from './MatterWorld.ts'
import type { MatterType } from './_Matter-types.ts'

export type ElementAction = (world: MatterWorld, x: number, y: number, idx: number, next: Set<number>) => void

export type ElementDef = {
  name: string,
  id: MatterType,
  action?: ElementAction,
  passive?: boolean,
}

const noop = () => {
}

export const elementStore = (() => {
  const ELEMENT_ACTIONS: ElementAction[] = []
  const PASSIVE = new Set()

  const ELEMENT_NAMES = new Map<MatterType, string>()

  return {
    add({
          id,
          name,
          action = noop,
          passive = false,
        }: ElementDef) {

      ELEMENT_ACTIONS[id] = action
      ELEMENT_NAMES.set(id, name)

      if (passive) {
        PASSIVE.add(id)
      }

      return id
    },
    finalize() {

      Object.freeze(ELEMENT_ACTIONS)
      Object.freeze(PASSIVE)

      return {
        ELEMENT_ACTIONS,
        ELEMENT_NAMES,
        PASSIVE,
      }
    },
  }
})()

const modules = import.meta.glob('./elements/*.ts', { eager: true }) as Record<string, { default: ElementDef }>
for (const path in modules) {
  elementStore.add(modules[path].default)
}

export const {
  ELEMENT_ACTIONS,
  ELEMENT_NAMES,
  PASSIVE: PASSIVE_ELEMENTS,
} = elementStore.finalize()