import { Input } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { ActionInput, KeyEvent } from '../PlayerActions.ts'
import Key = Phaser.Input.Keyboard.Key
import UP = Input.Keyboard.Events.UP
import DOWN = Input.Keyboard.Events.DOWN

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

  onDown(cb: KeyEvent): () => void {
    const handler = (_k: Key, e: KeyboardEvent) => cb(e)

    for (const key of this.keys) key.on(DOWN, handler)
    return () => {
      for (const key of this.keys) key.off(DOWN, handler)
    }
  }

  onUp(cb: KeyEvent): () => void {
    const handler = (_k: Key, e: KeyboardEvent) => cb(e)
    for (const key of this.keys) key.on(UP, handler)
    return () => {
      for (const key of this.keys) key.off(UP, handler)
    }
  }
}