<script setup lang="ts">
import { bindingLabels } from '../../../game/lib/Input/PlayerActions.ts'
import { INPUT_ACTIONS } from '../../../input.ts'
import { useInstantWeaponUIState } from '../../../store/weaponUIState/InstantWeaponUIState.ts'
import KbdArray from './Partials/KbdArray.vue'
import WeaponInputCharge from './Partials/WeaponInputCharge.vue'

const state = useInstantWeaponUIState()
const primary = bindingLabels(INPUT_ACTIONS.FIRE_PRIMARY)

const prev = bindingLabels(INPUT_ACTIONS.PREV_MODE)
const next = bindingLabels(INPUT_ACTIONS.NEXT_MODE)

</script>
<template>
  <span class="imu-section">
    <KbdArray :values="primary" />
    = charge {{ state.fireModeDisplayName }}
  </span>

  <span class="imu-section">
    <strong>Mode: </strong> {{ state.fireMode }}
    <KbdArray :values="prev" />
    /
    <KbdArray :values="next" />
    = prev / next
  </span>

  <WeaponInputCharge />
</template>
<style lang="scss">

</style>