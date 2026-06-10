<script setup lang="ts">
import { INPUT_ACTIONS } from '../../../input.ts'
import { useInstantWeaponUIState } from '../../../store/weaponUIState/InstantWeaponUIState.ts'
import WeaponInputCharge from './Partials/WeaponInputCharge.vue'

const state = useInstantWeaponUIState()

const prev = INPUT_ACTIONS.PREV_MODE.join(',')
const next = INPUT_ACTIONS.NEXT_MODE.join(',')

</script>
<template>
  <span class="imu-section">
    <kbd>LMB</kbd> = charge {{ state.fireModeDisplayName }}
  </span>

  <span class="imu-section">
    <strong>Mode: </strong> {{ state.fireMode }}
    <kbd>{{ prev }}</kbd> / <kbd>{{ next }}</kbd> = prev / next
  </span>

  <WeaponInputCharge />
</template>
<style lang="scss">

</style>