import { Game, Scale, WEBGL } from 'phaser'
import { GRAVITY } from './game/config.ts'
import { BG_COLOR } from './game/config/colors.ts'
import { setGame } from './game/launcher.ts'
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
      positionIterations: 8,
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
  setGame(game)

  const help = document.getElementById('help')!
  const btn = document.getElementById('btn-help')!

  btn.addEventListener('click', () => {
    help?.classList.add('show')
  })
  help.addEventListener('click', () => {
    help?.classList.remove('show')
  })
})

