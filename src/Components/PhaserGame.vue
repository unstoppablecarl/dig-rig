<script setup lang="ts">
import { Game, type Scene } from 'phaser'
import { onMounted, onUnmounted, shallowRef } from 'vue'
import startGame from '../game/main'
import { GameLevel } from '../game/scenes/GameLevel.ts'

const gameLevelScene = shallowRef<Scene>()
const game = shallowRef<Game>()

const emit = defineEmits<{
  'game-level-loaded': [level: GameLevel]
}>()

onMounted(() => {
  game.value = startGame('game-container', (current: GameLevel) => {
    emit('game-level-loaded', current)
    gameLevelScene.value = current
  })
})

onUnmounted(() => {
  if (game.value) {
    game.value.destroy(true)
    // @ts-expect-error: destroy
    game.value = null
  }
})

defineExpose({ gameLevelScene, game })
</script>
<template>
  <div id="game-container"></div>
</template>
<style lang="scss">
#game-container {
  overflow: hidden;
  contain: layout style paint;
}
</style>