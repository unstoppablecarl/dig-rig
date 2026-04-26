import { Math as PMath, Scale } from 'phaser'
import { getFactor } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import RESIZE = Scale.Events.RESIZE

const INITIAL_ZOOM = 3

export class CameraController extends SceneBound {

  private minZoom: number
  private maxZoom = 10

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.calcMinZoom()

    scene.cameras.main.setZoom(INITIAL_ZOOM)
    scene.game.scale.on(RESIZE, this.calcMinZoom, this)
  }

  calcMinZoom() {
    const worldWidth = this.scene.worldBounds.width
    const worldHeight = this.scene.worldBounds.height

    // min zoom to fit entire world in viewport
    this.minZoom = Math.min(
      this.scene.game.canvas.width / worldWidth,
      this.scene.game.canvas.height / worldHeight,
    )
  }

  adjustZoom(delta: number) {
    this.setZoom(this.scene.cameras.main.zoom - delta)
  }

  setZoom(zoom: number) {
    const z = PMath.Clamp(zoom, this.minZoom, this.maxZoom)
    this.scene.cameras.main.setZoom(z)
  }

  getZoomFactor() {
    return getFactor(this.minZoom, this.maxZoom, this.scene.cameras.main.zoom)
  }

  update() {
    const camera = this.scene.cameras.main
    const worldBounds = this.scene.worldBounds
    const canvasWidth = this.scene.game.canvas.width
    const canvasHeight = this.scene.game.canvas.height
    const playerContainer = this.scene.player.container

    const halfViewWidth = canvasWidth / (camera.zoom * 2)
    const halfViewHeight = canvasHeight / (camera.zoom * 2)

    let targetCenterX = playerContainer.x
    let targetCenterY = playerContainer.y

    targetCenterX = PMath.Clamp(targetCenterX, worldBounds.left + halfViewWidth, worldBounds.right - halfViewWidth)
    targetCenterY = PMath.Clamp(targetCenterY, worldBounds.top + halfViewHeight, worldBounds.bottom - halfViewHeight)

    camera.centerOn(targetCenterX, targetCenterY)
  }

  destroy() {
    this.scene.game.scale.off(RESIZE, this.calcMinZoom, this)
    super.destroy()
  }
}