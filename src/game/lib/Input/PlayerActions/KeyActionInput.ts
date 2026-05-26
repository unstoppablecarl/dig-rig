import { Input } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { ActionInput } from '../PlayerActions.ts'

export class KeyActionInput implements ActionInput {
  private readonly keys: Input.Keyboard.Key[]

  constructor(scene: GameLevel, keyIds: (string | number)[]) {
    this.keys = keyIds.map(k => scene.input.keyboard!.addKey(k))
  }

  isDown(): boolean {
    return this.keys.some(k => k.isDown)
  }

  isUp(): boolean {
    return this.keys.every(k => k.isUp)
  }

  onDown(cb: () => void): () => void {
    for (const key of this.keys) key.on('down', cb)
    return () => {
      for (const key of this.keys) key.off('down', cb)
    }
  }

  onUp(cb: () => void): () => void {
    for (const key of this.keys) key.on('up', cb)
    return () => {
      for (const key of this.keys) key.off('up', cb)
    }
  }
}