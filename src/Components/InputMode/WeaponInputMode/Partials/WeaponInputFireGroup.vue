<script setup lang="ts">
import { bindingLabels } from '../../../../game/lib/Input/PlayerActions.ts'
import { INPUT_ACTIONS } from '../../../../input.ts'
import { useWeaponUIState } from '../../../../store/weaponUIState.ts'
import KbdArray from './KbdArray.vue'

const state = useWeaponUIState()
const primary = bindingLabels(INPUT_ACTIONS.FIRE_PRIMARY)
const secondary = bindingLabels(INPUT_ACTIONS.FIRE_SECONDARY)

const prev = bindingLabels(INPUT_ACTIONS.PREV_MODE)
const next = bindingLabels(INPUT_ACTIONS.NEXT_MODE)
</script>
<template>
  <span class="imu-section">
    <KbdArray :values="prev" />
    /
    <KbdArray :values="next" />
    = Change Fire Group
  </span>

  <span class="imu-section">
    <span>
      <KbdArray :values="primary" />
      = {{ state.fireGroupPrimaryName }}
    </span>
    <span>
      <KbdArray :values="secondary" />
      = {{ state.fireGroupSecondaryName }}
    </span>
  </span>
</template>
<style lang="scss">

</style>