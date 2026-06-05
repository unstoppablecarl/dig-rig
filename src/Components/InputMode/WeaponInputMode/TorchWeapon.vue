<script setup lang="ts">
import { useWeaponUIState } from '../../../store/weaponUIState.ts'

const state = useWeaponUIState()

</script>
<template>
  <span class="imu-section">
    <kbd>LMB</kbd> = {{ state.fireGroupPrimaryName }}
    <kbd>RMB</kbd> = {{ state.fireGroupSecondaryName }}
  </span>
</template>
<style lang="scss">

</style>