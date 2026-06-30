import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { type ManagerItem } from '../Util/BasicManager.ts'
import type { EntityManager } from './EntityManager.ts'

export abstract class Entity extends SceneBound<GameLevel> implements ManagerItem<EntityManager> {
  private parent: EntityManager | null = null

  setManager(parent: EntityManager): void {
    this.parent = parent
  }

  abstract update(time: number, delta: number): void

  protected onDestroy(): void {
    this.parent?.remove(this)
    this.parent = null
  }
}
