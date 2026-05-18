import { Game, Scale, WEBGL } from 'phaser'
import { BG_COLOR, GRAVITY } from './game/config.ts'
import { pluginEventBusConfig } from './game/lib/plugins/events-plugin.ts'
import { pluginMatterCollisionConfig } from './game/lib/plugins/matter-collision-plugin.ts'
import { Boot } from './game/scenes/Boot.ts'
import { type LevelId, LEVELS } from './game/scenes/Levels'
import { LevelSelect } from './game/scenes/LevelSelect.ts'
import './styles/main.scss'
import GameConfig = Phaser.Types.Core.GameConfig

const config: GameConfig = {
  type: WEBGL,
  width: 1024,
  height: 768,
  scale: {
    mode: Scale.RESIZE,
    autoRound: true,
  },
  dom: {
    createContainer: true,
  },
  parent: 'game-container',
  backgroundColor: BG_COLOR,
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  physics: {
    default: 'matter',
    matter: {
      positionIterations: 20,
      gravity: { x: 0, y: GRAVITY },
      enableSleeping: false,
      debug: false,
    },
  },
  plugins: {
    scene: [
      pluginMatterCollisionConfig,
      pluginEventBusConfig,
    ],
  },
  scene: [
    Boot,
    LevelSelect,
  ],
}

let game: Game
document.addEventListener('DOMContentLoaded', () => {
  game = new Game({ ...config, parent: 'game-container' })

  const help = document.getElementById('help')!
  const btn = document.getElementById('btn-help')!

  btn.addEventListener('click', () => {
    help?.classList.add('show')
  })
  help.addEventListener('click', () => {
    help?.classList.remove('show')
  })
})

export async function launchLevel(id: LevelId) {
  const entry = LEVELS[id]
  if (!entry) {
    console.warn(`Unknown level: ${id}`)
    return
  }

  localStorage.setItem('level', id)

  // Lazy-register on first use
  if (!game.scene.getScene(id)) {
    const module = await entry.load()
    game.scene.add(id, module.default, false, entry)
  }

  // Stop whatever's currently running (menu, another level)
  // so we don't end up with multiple active scenes layered.
  for (const active of game.scene.getScenes(true)) {
    if (active.scene.key !== id) active.scene.stop()
  }

  game.scene.start(id)
}