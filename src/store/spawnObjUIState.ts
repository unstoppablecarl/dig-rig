import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { ref } from 'vue'
import { Crate } from '../game/lib/Entities/defs/Crate.ts'

export type SpawnObjUIState = ReturnType<typeof useSpawnObjUIState>

type SerializedData = {
  spawnId: string
}

export const useSpawnObjUIState = defineStore('spawn-obj-ui-state', () => {

  const spawnId = ref<string>(Crate.SPAWNER.id)

  const state = {
    spawnId,
  }

  const defaults: SerializedData = {
    spawnId: spawnId.value,
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

    spawnId,
  }
}, {
  persist: true,
})
