import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { shallowRef } from 'vue'
import { Crate } from '../game/lib/Entities/defs/Crate.ts'
import type { ConcreteEntityConstructor } from '../game/lib/Entities/_Entity.types.ts'

export type SpawnObjUIState = ReturnType<typeof useSpawnObjUIState>

type SerializedData = {
  spawnType: ConcreteEntityConstructor
}

export const useSpawnObjUIState = defineStore('spawn-obj-ui-state', () => {
  const spawnType = shallowRef<ConcreteEntityConstructor>(Crate)

  const state = {
    spawnType,
  }

  const defaults: SerializedData = {
    spawnType: spawnType.value,
  }

  const {
    $reset,
    $serializeState,
    $restoreState,
  } = makeSimplePersistMapper<SerializedData>(
    state,
    defaults,
  )

  return {
    $reset,
    $serializeState,
    $restoreState,

    spawnType,
  }
}, {
  persist: true,
})
