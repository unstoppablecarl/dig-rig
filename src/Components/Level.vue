<script setup lang="ts">
import { useUIState } from '../store/uiState.ts'

const uiState = useUIState()
</script>
<template>
  <div class="current-level-text">{{ uiState.currentLevelDisplayName }}</div>
</template>
<style lang="scss">
.current-level-text {
  position: fixed;
  top: 10px;
  left: 80px;
  font-size: 12px;
}
</style>
