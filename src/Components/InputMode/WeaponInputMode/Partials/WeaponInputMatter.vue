<script setup lang="ts">
import { bindingLabels } from '../../../../game/lib/Input/PlayerActions.ts'
import { INPUT_ACTIONS } from '../../../../input.ts'
import { useWeaponUIState } from '../../../../store/weaponUIState.ts'
import KbdArray from './KbdArray.vue'

const state = useWeaponUIState()

const prev = bindingLabels(INPUT_ACTIONS.PREV_MATTER_TYPE)
const next = bindingLabels(INPUT_ACTIONS.NEXT_MATTER_TYPE)
</script>
<template>
  <span class="imu-section">
    <KbdArray :values="prev" />
    /
    <KbdArray :values="next" />
    = Matter: {{ state.matterTypeName }}
  </span>
</template>
<style lang="scss">

</style>