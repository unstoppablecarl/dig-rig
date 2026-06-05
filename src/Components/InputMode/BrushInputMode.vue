<script setup lang="ts">
import { MatterType } from '../../game/lib/Matter/_Matter-types.ts'
import { useBrushUIState } from '../../store/brushUIState.ts'

const state = useBrushUIState()
</script>
<template>
  <div class="imu">
    <div class="imu-header">
      <span class="imu-label">Brush</span>
      <strong>{{ MatterType[state.matterType] }}</strong>
    </div>
    <span class="imu-section">
      Radius: {{ state.radius }} <kbd>Mouse Wheel</kbd> = resize
    </span>
    <span class="imu-section">
      <kbd>LMB</kbd> = paint
    </span>
    <span class="imu-section">
      <kbd>Shift+LMB</kbd> / <kbd>RMB</kbd> = erase
    </span>
  </div>
</template>
