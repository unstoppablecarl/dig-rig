<script setup lang="ts">
import { INPUT_ACTIONS } from '../../../input.ts'
import { useWeaponUIState } from '../../../store/weaponUIState.ts'

const state = useWeaponUIState()
const prev = INPUT_ACTIONS.PREV_MODE.join(',')
const next = INPUT_ACTIONS.NEXT_MODE.join(',')

</script>
<template>
  <span class="imu-section">
    <kbd>{{ prev }}</kbd> /
    <kbd>{{ next }}</kbd> = Change Fire Group
  </span>

  <span class="imu-section">
    <span>
      <kbd>LMB</kbd> = {{ state.fireGroupPrimaryName }}
    </span>
    <span>
      <kbd>RMB</kbd> = {{ state.fireGroupSecondaryName }}
    </span>
  </span>
</template>
<style lang="scss">

</style>