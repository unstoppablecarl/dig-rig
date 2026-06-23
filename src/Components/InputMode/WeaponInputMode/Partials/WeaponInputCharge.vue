<script setup lang="ts">
import { bindingLabels } from '../../../../game/lib/Input/PlayerActions.ts'
import { INPUT_ACTIONS } from '../../../../input.ts'
import { useWeaponUIState } from '../../../../store/weaponUIState.ts'
import KbdArray from './KbdArray.vue'

const state = useWeaponUIState()

const sub = bindingLabels(INPUT_ACTIONS.CHARGE_DECREASE)
const add = bindingLabels(INPUT_ACTIONS.CHARGE_INCREASE)
</script>
<template>
  <span class="imu-section">
    <strong>Charge: </strong>
    <kbd>Mouse Wheel</kbd> /
    <KbdArray :values="sub" />
    /
    <KbdArray :values="add" />
    = {{ state.charge }}
  </span>
</template>
<style lang="scss">

</style>