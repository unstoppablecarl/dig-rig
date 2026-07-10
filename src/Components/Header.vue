<script setup lang="ts">
import { useUIState } from '../store/uiState.ts'

const uiState = useUIState()
</script>
<template>
  <div class="header">
    <button role="button" class="btn-help" @click="uiState.helpModal = true">HELP</button>

    <div class="section fps">
      <strong>FPS:</strong> {{ uiState.fps }}
    </div>
    <div class="section fps">
      <strong>Sim:</strong> {{ uiState.simFps }}
    </div>
    <div class="section">{{ uiState.currentLevelDisplayName }}</div>

  </div>
</template>
<style lang="scss">
$padding: 4px 8px;

.header {
  position: fixed;
  top: 5px;
  left: 13px;
  font-size: 12px;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  white-space: nowrap;
  gap: 10px;
  pointer-events: none;

  .section {
    padding: $padding;
    pointer-events: none;
  }
}

.fps {
  width: 80px;
}

.btn-help {
  font-size: 14px;
  background: rgba(0, 0, 0, .75);
  border-radius: 5px;
  padding: $padding;
  color: rgba(255, 255, 255, .75);
  text-decoration: none;
  border: none;
  cursor: pointer;
  pointer-events: all;

  &:hover {
    color: rgba(255, 255, 255, .95);
    background: rgba(0, 0, 0, .95);
  }
}
</style>