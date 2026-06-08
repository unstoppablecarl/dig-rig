import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { computed, ref, watch } from 'vue'
import { FireGroup, FireGroupModes, FireGroupValues, FireMode } from '../game/lib/Player/_FireMode-types.ts'
import { PlayerWeapon, WEAPONS } from '../game/lib/Player/weapons.ts'

export type WeaponUIState = ReturnType<typeof useWeaponUIState>

type SerializedData = {
  id: PlayerWeapon
  fireGroup: FireGroup,
}

export const useWeaponUIState = defineStore('weapon-ui-state', () => {
  const id = ref<PlayerWeapon>(PlayerWeapon.BASIC)
  const fireGroup = ref<FireGroup>(FireGroup.CREATE_DESTROY)
  const charge = ref(0)

  const displayName = computed(() => WEAPONS[id.value].displayName)
  const slot = computed(() => WEAPONS[id.value].slot)

  const fireGroupIndex = computed(() => FireGroupValues.indexOf(fireGroup.value))

  const fireGroupPrimary = computed(() => FireGroupModes[fireGroup.value].PRIMARY)
  const fireGroupSecondary = computed(() => FireGroupModes[fireGroup.value].SECONDARY)

  const fireGroupPrimaryName = computed(() => FireMode[fireGroupPrimary.value])
  const fireGroupSecondaryName = computed(() => FireMode[fireGroupSecondary.value])

  function prevFireGroup() {
    let index: number
    if (fireGroupIndex.value === 0) {
      index = FireGroupValues.length - 1
    } else {
      index = fireGroupIndex.value - 1
    }
    fireGroup.value = FireGroupValues[index]
  }

  function nextFireGroup() {
    let index: number
    if (fireGroupIndex.value === FireGroupValues.length - 1) {
      index = 0
    } else {
      index = fireGroupIndex.value + 1
    }
    fireGroup.value = FireGroupValues[index]
  }

  const state = {
    id,
    fireGroup,
  }

  const defaults: SerializedData = {
    id: id.value,
    fireGroup: fireGroup.value,
  }

  const {
    $reset,
    $serializeState,
    $restoreState,
  } = makeSimplePersistMapper<SerializedData>(
    state,
    defaults,
  )

  watch(charge, () => {
    debugger
  })

  return {
    $reset,
    $serializeState,
    $restoreState,

    prevFireGroup,
    nextFireGroup,

    id,
    fireGroup,
    charge,

    // readonly
    slot,
    displayName,
    fireGroupPrimary,
    fireGroupSecondary,
    fireGroupPrimaryName,
    fireGroupSecondaryName,
  }
}, {
  persist: true,
})

