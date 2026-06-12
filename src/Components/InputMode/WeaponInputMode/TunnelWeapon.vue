<script setup lang="ts">
import { INPUT_ACTIONS } from '../../../input.ts'

const primary = INPUT_ACTIONS.FIRE_PRIMARY.join(',')
</script>
<template>
  <span class="imu-section">
    <kbd>{{ primary }}</kbd> = DIG
  </span>
</template>
<style lang="scss">

</style>