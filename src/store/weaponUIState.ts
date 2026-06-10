import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { computed, ref } from 'vue'
import { FIRE_GROUP_COLORS } from '../game/config/colors.ts'
import { makeArrayCyclerRef } from '../game/helpers/ArrayCycler.ts'
import { MatterType, MatterTypeValues } from '../game/lib/Matter/_Matter-types.ts'
import type { MatterTank } from '../game/lib/Matter/MatterTank/MatterTank.ts'
import { FireGroup, FireGroupModes, FireGroupValues, FireMode } from '../game/lib/Player/_FireMode-types.ts'
import { PlayerWeapon, WEAPONS } from '../game/lib/Player/weapons.ts'
import { rawRef } from './_helpers.ts'

export type WeaponUIState = ReturnType<typeof useWeaponUIState>

type SerializedData = {
  id: PlayerWeapon
  fireGroup: FireGroup,
  charge: number,
}

export const useWeaponUIState = defineStore('weapon-ui-state', () => {
  const id = ref<PlayerWeapon>(PlayerWeapon.BASIC)
  const charge = ref(20)

  const activeMatterTank = rawRef<MatterTank | null>(null)

  const displayName = computed(() => WEAPONS[id.value].displayName)
  const slot = computed(() => WEAPONS[id.value].slot)

  const {
    prev: prevFireGroup,
    next: nextFireGroup,
    value: fireGroup,
  } = makeArrayCyclerRef(FireGroupValues, FireGroup.CREATE_DESTROY)

  const {
    prev: prevMatterType,
    next: nextMatterType,
    value: matterType,
  } = makeArrayCyclerRef(MatterTypeValues, MatterType.SOLID)

  const fireGroupPrimary = computed(() => FireGroupModes[fireGroup.value].PRIMARY)
  const fireGroupSecondary = computed(() => FireGroupModes[fireGroup.value].SECONDARY)

  const fireGroupPrimaryName = computed(() => FireMode[fireGroupPrimary.value])
  const fireGroupSecondaryName = computed(() => FireMode[fireGroupSecondary.value])

  const fireGroupColor = computed(() => FIRE_GROUP_COLORS[fireGroup.value])

  const state = {
    id,
    fireGroup,
    charge,
  }

  const defaults: SerializedData = {
    id: id.value,
    fireGroup: fireGroup.value,
    charge: charge.value,
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

    prevFireGroup,
    nextFireGroup,

    prevMatterType,
    nextMatterType,

    id,
    fireGroup,
    charge,
    activeMatterTank,
    matterType,

    // readonly
    slot,
    displayName,
    fireGroupPrimary,
    fireGroupSecondary,
    fireGroupPrimaryName,
    fireGroupSecondaryName,
    fireGroupColor,
  }
}, {
  persist: true,
})

