<script setup lang="ts">
import { ref } from 'vue'
import Header from './Components/Header.vue'
import HelpModal from './Components/HelpModal.vue'
import InputMode from './Components/InputMode.vue'
import PhaserGame from './Components/PhaserGame.vue'

const helpVisible = ref(false)
</script>
<template>
  <PhaserGame />
  <Header />
  <InputMode />
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
