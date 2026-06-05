<script setup lang="ts">
import { useUIState } from '../store/uiState.ts'

const uiState = useUIState()
</script>
<template>
  <div class="fps-text">FPS: {{ uiState.fps }}</div>
</template>
<style lang="scss">
.fps-text {
  position: fixed;
  top: 10px;
  left: 10px;
  font-size: 12px;
}
</style>