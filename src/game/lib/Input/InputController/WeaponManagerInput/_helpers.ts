import type { InputController } from '../InputController.ts'

export function addFireGroupInput(target: InputController) {
  const a = target.scene.playerActions
  target.addInput(() => [
    a.PREV_MODE.onDown(() => {
      target.scene.weaponUIState.prevFireGroup()
    }),
    a.NEXT_MODE.onDown(() => {
      target.scene.weaponUIState.nextFireGroup()
    }),
  ])
}