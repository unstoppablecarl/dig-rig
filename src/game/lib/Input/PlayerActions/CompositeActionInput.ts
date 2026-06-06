import type { ActionInput } from '../PlayerActions.ts'

export class CompositeActionInput implements ActionInput {
  constructor(private readonly inputs: ActionInput[]) {
  }

  isDown(): boolean {
    return this.inputs.some(i => i.isDown())
  }

  isUp(): boolean {
    return this.inputs.every(i => i.isUp())
  }

  onDown(cb: () => void): () => void {
    let downCount = 0
    const unsubs = this.inputs.flatMap(input => [
      input.onDown(() => {
        if (downCount++ === 0) cb()
      }),
      input.onUp(() => {
        downCount = Math.max(0, downCount - 1)
      }),
    ])
    return () => unsubs.forEach(u => u())
  }

  onUp(cb: () => void): () => void {
    let downCount = 0
    const unsubs = this.inputs.flatMap(input => [
      input.onDown(() => {
        downCount++
      }),
      input.onUp(() => {
        if (--downCount <= 0) {
          downCount = 0
          cb()
        }
      }),
    ])
    return () => unsubs.forEach(u => u())
  }
}
