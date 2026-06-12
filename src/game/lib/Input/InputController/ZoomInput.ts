import { InputController } from './InputController.ts'

export class ZoomInput extends InputController {
  onMouseWheel(deltaY: number, e: WheelEvent) {
    const active = this.scene.playerActions.ZOOM_MOUSE_WHEEL_MODIFIER.isDownForEvent?.(e) ?? false
    if (active) {
      this.scene.cameraController.adjustZoom(deltaY * 0.001)
    }
    return active
  }
}
