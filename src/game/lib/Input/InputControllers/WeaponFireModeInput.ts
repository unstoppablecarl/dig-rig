import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { KeysetInput } from './KeysetInput.ts'

export class WeaponFireModeInput extends KeysetInput {
  constructor(
    scene: GameLevel,
  ) {
    super(scene, {
      'r': () => this.scene.playerInputState.prevFireMode(),
      'f': () => this.scene.playerInputState.nextFireMode(),
    })
  }
}