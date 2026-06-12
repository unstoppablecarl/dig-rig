<script setup lang="ts">
import { MatterType } from '../../game/lib/Matter/_Matter.types.ts'
import { useBrushUIState } from '../../store/brushUIState.ts'

const state = useBrushUIState()
</script>
<template>
  <div class="imu">
    <div class="imu-header">
      <span class="imu-label">Brush</span>
    </div>
    <span class="imu-section">
      Radius: {{ state.radius }} <kbd>Mouse Wheel</kbd> = resize
    </span>
    <span class="imu-section">
      <kbd>LMB</kbd> = paint {{ MatterType[state.primaryMatterType] }}
    </span>
    <span class="imu-section">
      <kbd>RMB</kbd> = paint {{ MatterType[state.secondaryMatterType] }}
    </span>
    <span class="imu-section">
      <kbd>Shift+LMB</kbd> = erase
    </span>
  </div>
</template>
