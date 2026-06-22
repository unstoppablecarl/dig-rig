import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { computed, ref } from 'vue'
import { FIRE_GROUP_COLORS } from '../game/config/colors.ts'
import { makeArrayCyclerRef } from '../game/helpers/ArrayCycler.ts'
import { MatterType } from '../game/lib/Matter/_Matter.types.ts'
import type { MatterTank } from '../game/lib/Matter/Tank/MatterTank.ts'
import { FireGroup, FireGroupModes, FireGroupValues, FireMode } from '../game/lib/Player/_FireMode-types.ts'
import { PlayerWeapon, WEAPONS } from '../game/lib/Player/weapons.ts'
import {
  type CreateableMatterType,
  CreateableMatterTypes,
  fireModeToEffect,
} from '../game/lib/Projectiles/ProjectileEffect/ProjectileEffect.ts'
import { rawRef } from './_helpers.ts'

export type WeaponUIState = ReturnType<typeof useWeaponUIState>

type SerializedData = {
  id: PlayerWeapon
  fireGroup: FireGroup,
  charge: number,
  matterType: CreateableMatterType,
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
  } = makeArrayCyclerRef(CreateableMatterTypes, MatterType.SOLID)

  const matterTypeName = computed(() => MatterType[matterType.value])

  const fireGroupPrimary = computed(() => FireGroupModes[fireGroup.value].PRIMARY)
  const fireGroupPrimaryEffect = computed(() => fireModeToEffect(fireGroupPrimary.value, matterType.value))

  const fireGroupSecondary = computed(() => FireGroupModes[fireGroup.value].SECONDARY)
  const fireGroupSecondaryEffect = computed(() => fireModeToEffect(fireGroupSecondary.value, matterType.value))

  const fireGroupPrimaryName = computed(() => FireMode[fireGroupPrimary.value])
  const fireGroupSecondaryName = computed(() => FireMode[fireGroupSecondary.value])

  const fireGroupColor = computed(() => FIRE_GROUP_COLORS[fireGroup.value])

  const state = {
    id,
    fireGroup,
    charge,
    matterType,
  }

  const defaults: SerializedData = {
    id: id.value,
    fireGroup: fireGroup.value,
    charge: charge.value,
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
    matterTypeName,

    fireGroupPrimary,
    fireGroupPrimaryName,
    fireGroupPrimaryEffect,

    fireGroupSecondary,
    fireGroupSecondaryName,
    fireGroupSecondaryEffect,

    fireGroupColor,
  }
}, {
  persist: true,
})

