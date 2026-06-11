import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { ref } from 'vue'
import { MatterType } from '../game/lib/Matter/_Matter-types.ts'

export type BrushUIState = ReturnType<typeof useBrushUIState>

type SerializedData = {
  radius: number
  primaryMatterType: MatterType
  secondaryMatterType: MatterType

}

export const useBrushUIState = defineStore('brush-ui-state', () => {
  const radius = ref(20)
  const primaryMatterType = ref<MatterType>(MatterType.SOLID)
  const secondaryMatterType = ref<MatterType>(MatterType.FIRE)

  const state = {
    radius,
    primaryMatterType,
    secondaryMatterType,
  }

  const defaults: SerializedData = {
    radius: radius.value,
    primaryMatterType: primaryMatterType.value,
    secondaryMatterType: secondaryMatterType.value,
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
    primaryMatterType,
    secondaryMatterType,
  }
}, {
  persist: true,
})

