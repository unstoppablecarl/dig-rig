<script setup lang="ts">
import { Game } from 'phaser'
import { onMounted, onUnmounted } from 'vue'
import startGame from '../game/main'
import { GameLevel } from '../game/scenes/GameLevel.ts'

const emit = defineEmits<{
  'game-level-loaded': [game: Game, level: GameLevel]
}>()

let phaserGame: Game | null = null

onMounted(() => {
  phaserGame = startGame('game-container', (game, current) => {
    emit('game-level-loaded', game, current)
  })
})

onUnmounted(() => {
  phaserGame?.destroy(true)
  phaserGame = null
})
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