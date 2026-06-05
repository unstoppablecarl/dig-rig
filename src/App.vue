<script setup lang="ts">
import { ref } from 'vue'
import Fps from './Components/Fps.vue'
import HelpModal from './Components/HelpModal.vue'
import InputMode from './Components/InputMode.vue'
import Level from './Components/Level.vue'
import PhaserGame from './Components/PhaserGame.vue'

const helpVisible = ref(false)
</script>
<template>
  <PhaserGame />
  <Fps />
  <Level />
  <InputMode />
  <div id="toaster-text"></div>
  <button role="button" class="btn-help" @click="helpVisible = true">HELP</button>
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

.btn-help {
  position: absolute;
  right: 0;
  bottom: 0;
  font-size: 14px;
  background: rgba(0, 0, 0, .75);
  border-radius: 5px;
  padding: 4px 8px;
  color: rgba(255, 255, 255, .75);
  text-decoration: none;
  border: none;
  cursor: pointer;

  &:hover {
    color: rgba(255, 255, 255, .95);
    background: rgba(0, 0, 0, .95);
  }
}
</style>
