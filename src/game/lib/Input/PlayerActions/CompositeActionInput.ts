import type { ActionInput, KeyEvent, KeyEventGuard } from '../PlayerActions.ts'

export class CompositeActionInput implements ActionInput {
  constructor(private readonly inputs: ActionInput[], private guard?: KeyEventGuard) {
  }

  isDown(): boolean {
    return this.inputs.some(i => i.isDown())
  }

  isDownForEvent(e: MouseEvent): boolean {
    return this.inputs.some(i => i.isDownForEvent?.(e) ?? false)
  }

  isUp(): boolean {
    return this.inputs.every(i => i.isUp())
  }

  onDown(cb: KeyEvent): () => void {
    let downCount = 0
    const unsub = this.inputs.flatMap(input => [
      input.onDown((e) => {
        if (!this.guard?.(e)) return
        if (downCount++ === 0) cb(e)
      }),
      input.onUp(() => {
        downCount = Math.max(0, downCount - 1)
      }),
    ])
    return () => unsub.forEach(u => u())
  }

  onUp(cb: KeyEvent): () => void {
    let downCount = 0
    const unsub = this.inputs.flatMap(input => [
      input.onDown((e) => {
        if (!this.guard?.(e)) return
        downCount++
      }),
      input.onUp((e) => {
        if (--downCount <= 0) {
          downCount = 0
          cb(e)
        }
      }),
    ])
    return () => unsub.forEach(u => u())
  }
}
