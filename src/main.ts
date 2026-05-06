import { Game, Scale, WEBGL } from 'phaser'
import { BG_COLOR, GRAVITY } from './game/config.ts'
import { pluginEventBusConfig } from './game/lib/plugins/events-plugin.ts'
import { pluginMatterCollisionConfig } from './game/lib/plugins/matter-collision-plugin.ts'
import { Boot } from './game/scenes/Boot.ts'
import { LevelSelect } from './game/scenes/LevelSelect.ts'
import './styles/main.scss'
import GameConfig = Phaser.Types.Core.GameConfig

const config: GameConfig = {
  type: WEBGL,
  width: 1024,
  height: 768,
  scale: {
    mode: Scale.EXPAND,
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

document.addEventListener('DOMContentLoaded', () => {
  new Game({ ...config, parent: 'game-container' })
})