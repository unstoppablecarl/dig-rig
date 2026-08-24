<script setup lang="ts">
import { useWeaponUIState } from '../../store/weaponUIState.ts'

const state = useWeaponUIState()

</script>
<template>
  <div class="imu">
    <div class="imu-header">
      <span class="imu-slot">{{ state.slot }}</span>
      <span class="imu-label">Weapon</span>
      <strong>{{ state.displayName }}</strong>
    </div>
    <slot name="default" />
  </div>
</template>
