import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { ref } from 'vue'
import { MatterType } from '../game/lib/Matter/_Matter-types.ts'

export type BrushUIState = ReturnType<typeof useBrushUIState>

type SerializedData = {
  radius: number
  matterType: MatterType
}

export const useBrushUIState = defineStore('brush-ui-state', () => {
  const radius = ref(20)
  const matterType = ref<MatterType>(MatterType.SOLID)

  const state = {
    radius,
    matterType,
  }

  const defaults: SerializedData = {
    radius: radius.value,
    matterType: matterType.value,
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
    radius,
    matterType,
  }
}, {
  persist: true,
})

