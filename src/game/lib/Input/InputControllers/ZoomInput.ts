import { InputController } from './InputController.ts'

export class ZoomInput extends InputController {
  onWheel(deltaY: number) {
    const modifierDown = this.scene.playerActions.ZOOM_MODIFIER.isDown()
    if (modifierDown) {
      this.scene.cameraController.adjustZoom(deltaY * 0.001)
    }
    return modifierDown
  }
}
