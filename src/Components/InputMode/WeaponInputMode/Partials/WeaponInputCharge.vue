<script setup lang="ts">
import { INPUT_ACTIONS } from '../../../../input.ts'
import { useWeaponUIState } from '../../../../store/weaponUIState.ts'

const state = useWeaponUIState()

const sub = INPUT_ACTIONS.CHARGE_DECREASE.join(',')
const add = INPUT_ACTIONS.CHARGE_INCREASE.join(',')
</script>
<template>
  <span class="imu-section">
    <strong>Charge: </strong>
    <kbd>Mouse Wheel</kbd> / <kbd>{{ sub }}</kbd> / <kbd>{{ add }}</kbd> = {{ state.charge }}
  </span>
</template>
<style lang="scss">

</style>