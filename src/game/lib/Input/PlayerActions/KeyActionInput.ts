import { Input } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { ActionInput, KeyEvent } from '../PlayerActions.ts'
import DOWN = Input.Keyboard.Events.DOWN
import UP = Input.Keyboard.Events.UP
import Key = Input.Keyboard.Key

const MODIFIER_KEYS: Record<string, keyof Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>> = {
  SHIFT: 'shiftKey',
  CTRL: 'ctrlKey',
  CONTROL: 'ctrlKey',
  ALT: 'altKey',
  META: 'metaKey',
}

export class KeyActionInput implements ActionInput {
  private readonly keys: Input.Keyboard.Key[]
  private readonly keyIds: (string | number)[]

  constructor(scene: GameLevel, keyIds: (string | number)[]) {
    this.keyIds = keyIds
    this.keys = keyIds.map(k => scene.input.keyboard!.addKey(k))
  }

  isDown(): boolean {
    return this.keys.some(k => k.isDown)
  }

  isDownForEvent(e: MouseEvent): boolean {
    return this.keyIds.some(id => {
      const prop = typeof id === 'string' ? MODIFIER_KEYS[id.toUpperCase()] : undefined
      return prop ? e[prop] : false
    })
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