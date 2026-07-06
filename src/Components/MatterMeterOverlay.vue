<script setup lang="ts">
import { matterMeterState } from '../store/matterMeterState.ts'

const s = matterMeterState
</script>

<template>
  <div v-if="s.visible.value" class="matter-meter">
    <div class="meter-border">
      <div class="meter-inner">
      <div class="bar fill" :style="{ height: s.fillPercent.value * 100 + '%' }" />

      <!-- inside fill: create bars from top of fill downward -->
      <div
        class="bar create-pending"
        :style="{
          bottom: (s.fillPercent.value - s.pendingCreatePercent.value) * 100 + '%',
          height: s.pendingCreatePercent.value * 100 + '%',
        }"
      />
      <div
        class="bar create-charge"
        :style="{
          bottom: (s.fillPercent.value - s.pendingCreatePercent.value - s.createChargePercent.value) * 100 + '%',
          height: s.createChargePercent.value * 100 + '%',
        }"
      />

      <!-- above fill: destroy bars upward from fill top -->
      <div
        class="bar destroy-reserved"
        :style="{
          bottom: s.fillPercent.value * 100 + '%',
          height: s.reservedDestroyPercent.value * 100 + '%',
        }"
      />
      <div
        class="bar destroy-pending"
        :style="{
          bottom: (s.fillPercent.value + s.reservedDestroyPercent.value) * 100 + '%',
          height: s.pendingDestroyPercent.value * 100 + '%',
        }"
      />
      <div
        class="bar destroy-charge"
        :style="{
          bottom: (s.fillPercent.value + s.reservedDestroyPercent.value + s.pendingDestroyPercent.value) * 100 + '%',
          height: s.destroyChargePercent.value * 100 + '%',
        }"
      />
      </div>
    </div>
    <div class="meter-text">{{ s.matterText.value }}</div>
  </div>
</template>

<style lang="scss" scoped>
.matter-meter {
  position: fixed;
  top: 60px;
  left: 20px;
  width: 40px;
  pointer-events: none;
  user-select: none;
}

.meter-border {
  width: 100%;
  height: 300px;
  border: 1px solid white;
  box-sizing: border-box;
  position: relative;
}

.meter-inner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 2px;
}

.bar {
  position: absolute;
}

.fill {
  bottom: 0;
  left: 2px;
  right: 2px;
  background: white;
}

.create-pending {
  left: 4px;
  right: 4px;
  background: rgba(0, 70, 255, 0.5);
}

.create-charge {
  left: 9px;
  right: 9px;
  background: rgba(0, 70, 255, 0.75);
}

.destroy-reserved {
  left: 4px;
  right: 4px;
  background: rgba(170, 0, 255, 0.75);
}

.destroy-pending {
  left: 4px;
  right: 4px;
  background: rgba(255, 0, 70, 0.5);
}

.destroy-charge {
  left: 9px;
  right: 9px;
  background: rgba(255, 0, 70, 0.75);
}

.meter-text {
  width: 100%;
  height: 30px;
  background: white;
  color: black;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
