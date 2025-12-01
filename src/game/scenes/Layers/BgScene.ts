import { Scene } from 'phaser'
import type { GameLevel } from '../GameLevel.ts'
import { getFactor } from '../../helpers/_helpers.ts'
import Graphics = Phaser.GameObjects.Graphics
import TileSprite = Phaser.GameObjects.TileSprite
import Linear = Phaser.Math.Linear
import RESIZE = Phaser.Scale.Events.RESIZE

type Layer = {
  textureId: string,
  speedX: number,
  speedY: number,
  sprite: TileSprite
}

// max amount bg can move vertically
const MARGIN = 50
const DEBUG_INSET = 0

let layerIds: number[] = []
for (let i = 1; i < 7; i++) {
  layerIds.push(i)
}
layerIds.reverse()
const LAYERS = layerIds.map((id) => ({
  id,
  textureId: 'cav_bg_' + id,
  file: `backgrounds/cave/${id}.png`,
}))

export class BgScene extends Scene {
  static ID = 'BgScene'
  private gameScene: GameLevel

  constructor() {
    super(BgScene.ID)
  }

  private debugBorder: Graphics
  private parallaxLayers: Layer[] = []

  preload() {
    this.load.setPath('assets')

    LAYERS.forEach(({ textureId, file }) => {
      this.load.image(textureId, file)
    })
  }

  init() {
    this.game.scale.on(RESIZE, this.resize, this)
  }

  create({ gameScene }: { gameScene: GameLevel }) {
    this.gameScene = gameScene

    LAYERS.forEach(({ textureId }) => {
      this.textures.get(textureId).setFilter(Phaser.Textures.FilterMode.NEAREST)
    })

    this.parallaxLayers = LAYERS.map(({ textureId, id }) => {
      return {
        textureId,
        sprite: this.add.tileSprite(0, 0, 0, 0, textureId),
        speedX: Linear(0.5, 1, id / 8),
        speedY: id / 8,
      }
    })

    if (DEBUG_INSET) {
      this.debugBorder = this.add.graphics()
    }
    this.resize()
  }

  private resize() {
    const canvasWidth = this.gameScene.game.canvas.width
    const canvasHeight = this.gameScene.game.canvas.height
    const width = canvasWidth - DEBUG_INSET * 2
    const height = canvasHeight - DEBUG_INSET * 2
    const centerX = canvasWidth * 0.5
    const centerY = canvasHeight * 0.5

    if (DEBUG_INSET) {
      this.debugBorder
        .clear()
        .lineStyle(2, 0xff0000, 1)
        .strokeRect(DEBUG_INSET, DEBUG_INSET, width, height)
    }

    for (let layer of this.parallaxLayers) {
      const imgHeight = this.textures.get(layer.textureId).source[0].height
      const tileScale = (height + MARGIN * 2) / imgHeight
      layer.sprite
        .setSize(width, height)
        .setOrigin(0.5, 0.5)
        .setPosition(centerX, centerY)
        .setTileScale(tileScale)
    }
  }

  update() {
    const playerX = this.gameScene.player.x
    const playerY = this.gameScene.player.y
    const worldHeight = this.gameScene.worldBounds.height

    // -1 (player at top of world) to 1 (player at bottom of world)
    const playerFactorY = (getFactor(0, worldHeight, playerY) - 0.5) * 2
    const playerOffsetY = playerFactorY * MARGIN

    this.parallaxLayers.forEach(layer => {
      const parallaxX = playerX * (1 - layer.speedX)
      const parallaxY = playerOffsetY * (1 - layer.speedY)

      layer.sprite.setTilePosition(parallaxX, parallaxY)
    })
  }
}