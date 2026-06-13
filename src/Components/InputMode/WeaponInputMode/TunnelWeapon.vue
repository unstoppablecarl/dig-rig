<script setup lang="ts">
import { bindingLabels } from '../../../game/lib/Input/PlayerActions.ts'
import { INPUT_ACTIONS } from '../../../input.ts'
import KbdArray from './Partials/KbdArray.vue'

const primary = bindingLabels(INPUT_ACTIONS.FIRE_PRIMARY)
</script>
<template>
  <span class="imu-section">
    <KbdArray :values="primary" />
    = DIG
  </span>
</template>
<style lang="scss">

</style>