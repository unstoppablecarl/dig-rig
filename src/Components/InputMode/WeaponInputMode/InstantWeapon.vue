<script setup lang="ts">
import { bindingLabels } from '../../../game/lib/Input/PlayerActions.ts'
import { INPUT_ACTIONS } from '../../../input.ts'
import { useInstantWeaponUIState } from '../../../store/weaponUIState/InstantWeaponUIState.ts'
import KbdArray from './Partials/KbdArray.vue'
import WeaponInputCharge from './Partials/WeaponInputCharge.vue'
import WeaponInputMatter from './Partials/WeaponInputMatter.vue'

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

    <KbdArray :values="prev" />
    /
    <KbdArray :values="next" />
    = Mode: {{ state.fireModeDisplayName }}
  </span>
  <WeaponInputMatter />

  <WeaponInputCharge />
</template>
<style lang="scss">

</style>