<script setup lang="ts">
import { INPUT_ACTIONS } from '../../../../input.ts'
import { useWeaponUIState } from '../../../../store/weaponUIState.ts'

const state = useWeaponUIState()

const prev = INPUT_ACTIONS.PREV_MATTER_TYPE.join(',')
const next = INPUT_ACTIONS.NEXT_MATTER_TYPE.join(',')

</script>
<template>
  <span class="imu-section">
    <kbd>{{ prev }}</kbd> /
    <kbd>{{ next }}</kbd> = Matter: {{ state.matterTypeName }}
  </span>
</template>
<style lang="scss">

</style>