import { Game, Scale, WEBGL } from 'phaser'
import { GRAVITY } from './config.ts'
import { BG_COLOR } from './config/colors.ts'
import { setGame } from './launcher.ts'
import { GAME_LEVEL_LOADED } from './lib/events.ts'
import { pluginEventBusConfig } from './lib/plugins/events-plugin.ts'
import { pluginMatterCollisionConfig } from './lib/plugins/matter-collision-plugin.ts'
import { Boot } from './scenes/Boot.ts'
import type { GameLevel } from './scenes/GameLevel.ts'
import { LevelSelect } from './scenes/LevelSelect.ts'
import GameConfig = Phaser.Types.Core.GameConfig
import './lib/Matter/_Matter.glob.ts';

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

const startGame = (parent: string, onLevelLoaded: (game: Game, scene: GameLevel) => void) => {
  const game = new Game({ ...config, parent })
  setGame(game)
  game.events.on(GAME_LEVEL_LOADED, onLevelLoaded)

  game.scene.start(LevelSelect.ID)
  return game
}

export default startGame