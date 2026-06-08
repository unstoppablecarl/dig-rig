import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { computed, ref } from 'vue'
import { FIRE_MODE_COLORS } from '../../game/config/colors.ts'
import { FireMode, FireModeValues } from '../../game/lib/Player/_FireMode-types.ts'

export type InstantWeaponUIState = ReturnType<typeof useInstantWeaponUIState>

type SerializedData = {
  fireMode: FireMode
}

export const useInstantWeaponUIState = defineStore('instant-weapon-ui-state', () => {
  const fireMode = ref<FireMode>(FireMode.DESTROY)
  const fireModeIndex = computed(() => FireModeValues.indexOf(fireMode.value))
  const fireModeDisplayName = computed(() => FireMode[fireMode.value])

  const fireModeColor = computed(() => FIRE_MODE_COLORS[fireMode.value])

  const state = {
    fireMode,
  }

  const defaults: SerializedData = {
    fireMode: fireMode.value,
  }

  function prevFireMode() {
    let index: number
    if (fireModeIndex.value === 0) {
      index = FireModeValues.length - 1
    } else {
      index = fireModeIndex.value - 1
    }
    fireMode.value = FireModeValues[index]
  }

  function nextFireMode() {
    let index: number
    if (fireModeIndex.value === FireModeValues.length - 1) {
      index = 0
    } else {
      index = fireModeIndex.value + 1
    }
    fireMode.value = FireModeValues[index]
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

    prevFireMode,
    nextFireMode,

    fireMode,

    // readonly
    fireModeIndex,
    fireModeDisplayName,
    fireModeColor,
  }
}, {
  persist: true,
})

