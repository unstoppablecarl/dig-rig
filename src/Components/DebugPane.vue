<script setup lang="ts">
import type { Game } from 'phaser'
import {
  PButton,
  PCheckbox,
  PFolder,
  PGraph,
  PHeading,
  PMonitor,
  PNumber,
  pollingComputed,
  pollingRef,
  VPane,
} from 'vue-pane/src/index.ts'
import { launchLevel } from '../game/launcher.ts'
import { MATTER_NAMES } from '../game/lib/Matter/matter.ts'
import type { GameLevel } from '../game/scenes/GameLevel.ts'
import { type LevelEntry, type LevelId, LEVELS } from '../game/scenes/Levels'
import BrushPane from './DebugPane/BrushPane.vue'

const { game, level } = defineProps<{
  game: Game
  level: GameLevel
}>()

// Wrap in object so Vue template doesn't auto-unwrap the PollingRef to its value
const metrics = {
  fps: pollingRef(game.loop, 'actualFps', 100),
}

const matter = {
  universe: pollingComputed(() => level?.matterManager?.universeMatter() ?? 0, 500),
  world: pollingComputed(() => level?.matterManager?.terrainMatter() ?? 0, 500),
  player: pollingComputed(() => level?.matterManager?.playerMatter() ?? 0, 500),
}

const projectiles = {
  count: pollingComputed(() => level?.projectiles?.children?.length ?? 0, 200),
}

const physics = {
  total: pollingComputed(() => level?.matter?.world?.getAllBodies()?.length ?? 0, 500),
  static: pollingComputed(() => level?.matter?.world?.getAllBodies()?.filter(b => b.isStatic)?.length ?? 0, 500),
  dynamic: pollingComputed(() => level?.matter?.world?.getAllBodies()?.filter(b => !b.isStatic)?.length ?? 0, 500),
  sleeping: pollingComputed(() => level?.matter?.world?.getAllBodies()?.filter(b => b.isSleeping)?.length ?? 0, 500),
  terrain: pollingComputed(() => level?.terrainBlobParticleManager?.particles?.length ?? 0, 500),
}

const particles = {
  count: pollingComputed(() => level?.vfxParticleManager?.emitter?.getAliveParticleCount() ?? 0, 200),
  dead: pollingComputed(() => level?.vfxParticleManager?.emitter?.getDeadParticleCount() ?? 0, 200),
}

const input = {
  mousePos: pollingComputed(() => {
    const ptr = level?.input?.manager?.activePointer
    if (!ptr) return ''
    const r = level?.cameras?.main?.getWorldPoint(ptr.x, ptr.y)
    if (!r) return ''
    return `${r.x.toFixed(0)}, ${r.y.toFixed(0)}`
  }, 50),
}

const player = {
  vx: pollingComputed(() => level?.player?.container?.body?.velocity?.x ?? 0, 100),
  vy: pollingComputed(() => level?.player?.container?.body?.velocity?.y ?? 0, 100),
  touchLeft: pollingComputed(() => level?.player?.isTouching?.left, 100),
  touchRight: pollingComputed(() => level?.player?.isTouching?.right, 100),
  touchGround: pollingComputed(() => level?.player?.isTouching?.ground, 100),
}

function clearStorage() {
  localStorage.clear()
  window.location.reload()
}

const matterEntries = [...MATTER_NAMES.entries()]
const levelEntries = Object.entries(LEVELS) as [LevelId, LevelEntry][]
</script>
<template>
  <div class="debug-container">
    <VPane title="Debug">
      <PFolder title="FPS">
        <PGraph :poll="metrics.fps" label="FPS:" :min="0" :max="150" :decimal-places="0" />
      </PFolder>
      <PFolder title="Metrics">
        <PFolder title="Matter">
          <PNumber label="Universe" :poll="matter.universe" readonly />
          <PNumber label="World" :poll="matter.world" readonly />
          <PNumber label="Player" :poll="matter.player" readonly />
        </PFolder>
        <PFolder title="Projectiles">
          <PNumber label="Count" :poll="projectiles.count" readonly />
        </PFolder>
        <PFolder title="Physics Bodies">
          <PNumber label="Total" :poll="physics.total" readonly />
          <PNumber label="Static" :poll="physics.static" readonly />
          <PNumber label="Dynamic" :poll="physics.dynamic" readonly />
          <PNumber label="Sleeping" :poll="physics.sleeping" readonly />
          <PNumber label="Terrain" :poll="physics.terrain" readonly />
          <PButton label="Add"
                   @click="level.terrainBlobParticleManager.explode(level.player.x, level.player.y - 100, 100)" />
        </PFolder>
        <PFolder title="Particles">
          <PNumber label="Count" :poll="particles.count" readonly />
          <PNumber label="Dead" :poll="particles.dead" readonly />
        </PFolder>
      </PFolder>

      <PFolder title="State">
        <PFolder title="Input">
          <PMonitor label="Mouse Pos" :poll="input.mousePos" />
        </PFolder>
        <PFolder title="Player">
          <PNumber label="vx" :poll="player.vx" readonly />
          <PNumber label="vy" :poll="player.vy" readonly />
          <PHeading label="Collision" />
          <PCheckbox label="Left" :poll="player.touchLeft" readonly />
          <PCheckbox label="Right" :poll="player.touchRight" readonly />
          <PCheckbox label="Ground" :poll="player.touchGround" readonly />
        </PFolder>
      </PFolder>

      <PFolder title="Add Matter">
        <PButton
          v-for="[key, name] in matterEntries"
          :key="key"
          :label="`Add ${name}`"
          @click="level.matterBridge.addMatter(key, level.player.x, level.player.y - 100)"
        />
      </PFolder>
      <BrushPane :level="level" />
      <PFolder title="Controls">
        <PButton label="Clear Local Storage + Refresh" @click="clearStorage" />
      </PFolder>
      <PFolder title="Levels">
        <PButton
          v-for="[id, lvl] in levelEntries"
          :key="id"
          :label="lvl.displayName"
          @click="launchLevel(id)"
        />
      </PFolder>
    </VPane>
  </div>
</template>
<style scoped lang="scss">
.debug-container {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 256px;
  max-height: 98vh;
  overflow-y: auto;
  scrollbar-color: #888 transparent;
  scrollbar-width: thin;
}
</style>
