<script setup lang="ts">
import { INPUT_ACTIONS } from '../../../input.ts'
import { useWeaponUIState } from '../../../store/weaponUIState.ts'

const state = useWeaponUIState()

const prev = INPUT_ACTIONS.PREV_MODE.join(',')
const next = INPUT_ACTIONS.NEXT_MODE.join(',')
const sub = INPUT_ACTIONS.CHARGE_DECREASE.join(',')
const add = INPUT_ACTIONS.CHARGE_INCREASE.join(',')

</script>
<template>
  <span class="imu-section">
    <kbd>LMB</kbd> = charge {{ state.fireGroupPrimaryName }}
    <kbd>RMB</kbd> = charge {{ state.fireGroupSecondaryName }}
  </span>

  <span class="imu-section">
    <strong>Mode: </strong> {{ state.fireMode }} <kbd>{{ prev }}</kbd> / <kbd>{{ next }}</kbd> = prev / next
  </span>

  <span class="imu-section">
    <strong>Charge: </strong> {{ state.charge }} <kbd>Mouse Wheel</kbd> & <kbd>{{ sub }}</kbd> / <kbd>{{ add
    }}</kbd> =
    -/+
  </span>
</template>
<style lang="scss">

</style>