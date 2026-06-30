import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { ref } from 'vue'

export type SpawnObjUIState = ReturnType<typeof useSpawnObjUIState>

export enum SpawnType {
  CRATE
}

type SerializedData = {
  spawnType: SpawnType
}

export const useSpawnObjUIState = defineStore('spawn-obj-ui-state', () => {
  const spawnType = ref<SpawnType>(SpawnType.CRATE)

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
