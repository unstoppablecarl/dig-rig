<script setup lang="ts">
import { Game } from 'phaser'
import { markRaw, ref, shallowRef } from 'vue'
import DebugPane from './Components/DebugPane.vue'
import Header from './Components/Header.vue'
import HelpModal from './Components/HelpModal.vue'
import InputMode from './Components/InputMode.vue'
import MatterMeterOverlay from './Components/MatterMeterOverlay.vue'
import PhaserGame from './Components/PhaserGame.vue'
import { ENABLE_PANE_DEBUG } from './game/config.ts'
import { GameLevel } from './game/scenes/GameLevel.ts'

const helpVisible = ref(false)
const game = shallowRef<Game>()
const level = shallowRef<GameLevel>()

function onLoaded(newGame: Game, newLevel: GameLevel) {
  game.value = markRaw(newGame)
  level.value = markRaw(newLevel)
}
</script>
<template>
  <PhaserGame @game-level-loaded="onLoaded" />
  <MatterMeterOverlay />
  <Header />
  <InputMode />
  <template v-if="ENABLE_PANE_DEBUG">
    <DebugPane v-if="game && level" :game="game" :level="level" />
  </template>
  <div id="toaster-text"></div>
  <HelpModal v-model="helpVisible" />
</template>
<style lang="scss">
#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
