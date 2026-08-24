<script setup lang="ts">
import { computed } from 'vue'
import { PButton, PFolder, PSelect } from 'vue-pane/src/index.ts'
import { InputMode } from '../../game/lib/Input/_input.types.ts'
import type { GameLevel } from '../../game/scenes/GameLevel.ts'
import { useSpawnObjUIState } from '../../store/spawnObjUIState.ts'
import { useUIState } from '../../store/uiState.ts'

const { level } = defineProps<{
  level: GameLevel
}>()

const uiStore = useUIState()
const spawnObjUI = useSpawnObjUIState()

const isSpawnObjMode = computed(() => uiStore.inputMode === InputMode.SPAWN_OBJ)
const spawnObjLabel = computed(() => isSpawnObjMode.value ? 'Disable Spawn' : 'Enable Spawn')

function toggleSpawnObj() {
  if (level.inputManager.inputMode === InputMode.SPAWN_OBJ) {
    level.inputManager.setMode(InputMode.WEAPON)
  } else {
    level.inputManager.setMode(InputMode.SPAWN_OBJ)
  }
}

const spawnOptions = level.entityFactory.getOptions()

</script>
<template>
  <PFolder title="Spawn Obj">
    <PButton :label="spawnObjLabel" @click="toggleSpawnObj" />
    <PSelect
      label="Obj"
      :options="spawnOptions"
      v-model="spawnObjUI.spawnId"
    />
  </PFolder>
</template>