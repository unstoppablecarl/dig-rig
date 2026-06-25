<script setup lang="ts">
import { computed } from 'vue'
import { PButton, PFolder, PSelect } from 'vue-pane/src/index.ts'
import { InputMode } from '../../game/lib/Input/_input.types.ts'
import { EMPTY, SupportType } from '../../game/lib/Matter/_Matter.types.ts'
import {
  getImmutableSupportType,
  INDESTRUCTIBLE_TYPES,
  isSupportTypeImmutable,
  MATTER_NAMES,
} from '../../game/lib/Matter/matter.ts'
import type { GameLevel } from '../../game/scenes/GameLevel.ts'
import { useBrushUIState } from '../../store/brushUIState.ts'
import { useUIState } from '../../store/uiState.ts'
import BrushPaneSuportTypeTooltip from './BrushPaneSuportTypeTooltip.vue'

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
  .filter(([key]) => key !== EMPTY && !INDESTRUCTIBLE_TYPES.has(key))
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

const primarySupportDisabled = computed(() => {
  return isSupportTypeImmutable(brushUI.primaryMatterType)
})

const primarySupportTypeValue = computed<SupportType>({
  get() {
    if (primarySupportDisabled.value) {
      return getImmutableSupportType(brushUI.primaryMatterType)
    }
    return brushUI.primarySupportFlag
  },
  set(value: SupportType) {
    brushUI.primarySupportFlag = value
  },
})

const secondarySupportDisabled = computed(() => {
  return isSupportTypeImmutable(brushUI.secondaryMatterType)
})

const secondarySupportTypeValue = computed<SupportType>({
  get() {
    if (secondarySupportDisabled.value) {
      return getImmutableSupportType(brushUI.secondaryMatterType)
    }
    return brushUI.secondarySupportFlag
  },
  set(value: SupportType) {
    brushUI.secondarySupportFlag = value
  },
})
</script>
<template>
  <PFolder title="Brush">
    <PButton :label="brushLabel" @click="toggleBrush" />
    <PSelect
      label="Primary"
      :options="brushOptions"
      v-model="brushUI.primaryMatterType"

    />
    <PSelect
      label="-Support"
      :options="supportOptions"
      v-model="primarySupportTypeValue"
      :disabled="primarySupportDisabled"
    >
      <template #tooltip>
        <BrushPaneSuportTypeTooltip />
      </template>
    </PSelect>

    <PSelect
      label="Secondary"
      :options="brushOptions"
      v-model="brushUI.secondaryMatterType"
    />
    <PSelect
      label="-Support"
      :options="supportOptions"
      v-model="secondarySupportTypeValue"
      :disabled="secondarySupportDisabled"
    >
      <template #tooltip>
        <BrushPaneSuportTypeTooltip />
      </template>
    </PSelect>
  </PFolder>
</template>