import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { PhysicsBody } from './PhysicsBody.ts'

export class PhysicsBodyManager extends SceneBound<GameLevel> {
  public children: PhysicsBody[] = []

  add(item: PhysicsBody): void {
    this.children.push(item)
    item.setParent(this)
  }

  update() {
    for (let c of this.children) {
      c.update()
    }
  }

  remove(target: PhysicsBody) {
    // already destroyed
    if (!this.children) return

    const i = this.children.indexOf(target)
    if (i !== -1) {
      this.children[i] = this.children[this.children.length - 1]
      this.children.pop()
    }
  }

  protected onDestroy() {
    for (let c of this.children) {
      c.destroy()
    }

    // @ts-expect-error: destroy
    this.children = null
  }
}