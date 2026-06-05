<script setup lang="ts">
import { useWeaponUIState } from '../../../store/weaponUIState.ts'

const state = useWeaponUIState()

</script>
<template>
  <span class="imu-section">
    <span>
      <kbd>LMB</kbd> = {{ state.fireGroupPrimaryName }}
    </span>
    <span>
      <kbd>RMB</kbd> = {{ state.fireGroupSecondaryName }}
    </span>
  </span>

  <span class="imu-section">
    <strong>Charge: </strong> {{ state.charge }}
  </span>
</template>
<style lang="scss">

</style>