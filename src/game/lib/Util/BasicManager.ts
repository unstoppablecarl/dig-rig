import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'

export interface ManagerItem<T extends BasicManager<any>> {
  setManager: (parent: T) => void
  update: (time: number, delta: number) => void
  destroy: () => void
}

export class BasicManager<T extends ManagerItem<any>> extends SceneBound<GameLevel> {
  public children: T[] = []

  add(item: T): void {
    this.children.push(item)
    item.setManager(this)
  }

  update(time: number, delta: number): void {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].update(time, delta)
    }
  }

  remove(target: T) {
    // already destroyed
    if (!this.children) return

    const i = this.children.indexOf(target)
    if (i !== -1) {
      this.children[i] = this.children[this.children.length - 1]
      this.children.pop()
    }
    target.destroy()
  }

  protected onDestroy(): void {
    const snapshot = this.children.slice()
    this.children.length = 0
    for (const item of snapshot) {
      item.destroy()
    }
    // @ts-expect-error: destroy
    this.children = null
  }
}