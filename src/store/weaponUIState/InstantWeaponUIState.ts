import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { computed } from 'vue'
import { FIRE_MODE_COLORS } from '../../game/config/colors.ts'
import { makeArrayCyclerRef } from '../../game/helpers/ArrayCycler.ts'
import { FireMode, FireModeValues } from '../../game/lib/Player/_FireMode-types.ts'
import { fireModeToEffect } from '../../game/lib/Projectiles/ProjectileEffect/ProjectileEffect.ts'
import { useWeaponUIState } from '../weaponUIState.ts'

export type InstantWeaponUIState = ReturnType<typeof useInstantWeaponUIState>

type SerializedData = {
  fireMode: FireMode
}

export const useInstantWeaponUIState = defineStore('instant-weapon-ui-state', () => {
  const {
    prev: prevFireMode,
    next: nextFireMode,
    value: fireMode,
  } = makeArrayCyclerRef(FireModeValues, FireMode.DESTROY)

  const weaponStore = useWeaponUIState()

  const fireModeDisplayName = computed(() => FireMode[fireMode.value])
  const fireModeColor = computed(() => FIRE_MODE_COLORS[fireMode.value])
  const fireModeEffect = computed(() => fireModeToEffect(fireMode.value, weaponStore.matterType))

  const state = {
    fireMode,
  }

  const defaults: SerializedData = {
    fireMode: fireMode.value,
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
    fireModeDisplayName,
    fireModeColor,
    fireModeEffect,
  }
}, {
  persist: true,
})

