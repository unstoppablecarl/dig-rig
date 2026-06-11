import { Input } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { ActionInput, KeyEvent } from '../PlayerActions.ts'

const LEFT = 'LEFT' as const
const RIGHT = 'RIGHT' as const

export class PointerActionInput implements ActionInput {
  constructor(
    private readonly scene: GameLevel,
    private readonly side: typeof LEFT | typeof RIGHT,
  ) {
  }

  isDown(): boolean {
    const p = this.scene.input.activePointer
    return this.side === LEFT ? p.leftButtonDown() : p.rightButtonDown()
  }

  isUp(): boolean {
    return !this.isDown()
  }

  onDown(cb: KeyEvent): () => void {
    const handler = (pointer: Input.Pointer) => {
      if (this.side === LEFT && pointer.leftButtonDown()) cb(pointer)
      if (this.side === RIGHT && pointer.rightButtonDown()) cb(pointer)
    }
    this.scene.input.on(Input.Events.POINTER_DOWN, handler)
    return () => this.scene.input.off(Input.Events.POINTER_DOWN, handler)
  }

  onUp(cb: KeyEvent): () => void {
    const handler = (pointer: Input.Pointer) => {
      if (this.side === LEFT && pointer.leftButtonReleased()) cb(pointer)
      if (this.side === RIGHT && pointer.rightButtonReleased()) cb(pointer)
    }
    this.scene.input.on(Input.Events.POINTER_UP, handler)
    return () => this.scene.input.off(Input.Events.POINTER_UP, handler)
  }
}