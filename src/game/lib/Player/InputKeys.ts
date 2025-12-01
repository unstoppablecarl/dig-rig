import type { Scene } from 'phaser'

export type PlayerInput = ReturnType<typeof makePlayerInput>

export function makePlayerInput(scene: Scene) {

  const bind = (keyId: KeyId | KeyId[]) => new MultiInput(scene, keyId)

  const { LEFT, RIGHT, UP, DOWN, W, A, S, D, SPACE } = Phaser.Input.Keyboard.KeyCodes

  return {
    left: bind([LEFT, A]),
    right: bind([RIGHT, D]),
    jump: bind([UP, SPACE, W]),
    down: bind([DOWN, S]),
  }
}

type KeyId = string | number

export class MultiInput {
  private keys: Phaser.Input.Keyboard.Key[]

  constructor(scene: Scene, keys: KeyId | KeyId[]) {
    if (!Array.isArray(keys)) keys = [keys]
    this.keys = keys.map((key) => scene.input.keyboard!.addKey(key))
  }

  // any input down
  isDown() {
    return this.keys.some((key) => key.isDown)
  }

  // all input up
  isUp() {
    return this.keys.every((key) => key.isUp)
  }
}