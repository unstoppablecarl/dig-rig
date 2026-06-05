import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { computed, ref } from 'vue'
import { InputTypes } from '../game/lib/Input/_input.types.ts'
import { type LevelId, LEVELS } from '../game/scenes/Levels'

export type UIState = ReturnType<typeof useUIState>

type SerializedData = {
  levelId: LevelId,
  inputMode: InputTypes,
}

let DEFAULT_LEVEL_ID = Object.keys(LEVELS)[0] as LevelId

export const useUIState = defineStore('ui-state', () => {
  const fps = ref(0)

  const levelId = ref<LevelId>(DEFAULT_LEVEL_ID)
  const currentLevelDisplayName = computed(() => {
    if (!levelId.value) return ''
    return LEVELS[levelId.value].displayName
  })

  const inputMode = ref<InputTypes>(InputTypes.WEAPON)

  const state = {
    levelId,
    inputMode,
  }

  const defaults: SerializedData = {
    levelId: levelId.value,
    inputMode: inputMode.value,
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
    fps,
    levelId,
    inputMode,

    // readonly
    currentLevelDisplayName,
  }
}, {
  persist: true,
})

