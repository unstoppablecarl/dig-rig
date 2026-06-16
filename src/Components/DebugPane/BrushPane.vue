<script setup lang="ts">
import { computed } from 'vue'
import { PButton, PFolder, PSelect } from 'vue-pane/src/index.ts'
import { InputMode } from '../../game/lib/Input/_input.types.ts'
import { EMPTY, SupportType } from '../../game/lib/Matter/_Matter.types.ts'
import { MATTER_NAMES } from '../../game/lib/Matter/matter.ts'
import type { GameLevel } from '../../game/scenes/GameLevel.ts'
import { useBrushUIState } from '../../store/brushUIState.ts'
import { useUIState } from '../../store/uiState.ts'

const { level } = defineProps<{
  level: GameLevel
}>()

const uiStore = useUIState()
const brushUI = useBrushUIState()

const isBrushMode = computed(() => uiStore.inputMode === InputMode.BRUSH)
const brushLabel = computed(() => isBrushMode.value ? 'Disable Brush' : 'Enable Brush')

function toggleBrush() {
  if (level.inputManager.inputMode === InputMode.BRUSH) {
    level.inputManager.setMode(InputMode.WEAPON)
  } else {
    level.inputManager.setMode(InputMode.BRUSH)
  }
}

const brushOptions = [...MATTER_NAMES.entries()]
  .filter(([key]) => key !== EMPTY)
  .map(([key, value]) => ({
    value: key as string | number,
    label: value,
  }))

const supportOptions = [
  {
    value: SupportType.NONE,
    label: 'None',
  },
  {
    value: SupportType.AFFIXED,
    label: 'Affixed',
  },
  {
    value: SupportType.STRUCTURAL,
    label: 'Structural',
  },
  {
    value: SupportType.ANCHORED,
    label: 'Anchored',
  },
]

</script>
<template>
  <PFolder title="Brush">
    <PButton :label="brushLabel" @click="toggleBrush" />
    <PSelect label="Primary" :options="brushOptions" v-model="brushUI.primaryMatterType" />
    <PSelect label="Primary" :options="supportOptions" v-model="brushUI.primarySupportFlag" />

    <PSelect label="Secondary" :options="brushOptions" v-model="brushUI.secondaryMatterType" />
    <PSelect label="Secondary" :options="supportOptions" v-model="brushUI.secondarySupportFlag" />
  </PFolder>
</template>