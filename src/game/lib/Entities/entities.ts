import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { ConcreteEntityConstructor, EntitySpawner } from './_Entity.types.ts'

export class EntityFactory extends SceneBound<GameLevel> {

  entities = new Map<ConcreteEntityConstructor, EntitySpawner>()

  register(entitySpawners: EntitySpawner[]) {
    for (const entitySpawner of entitySpawners) {
      this.entities.set(entitySpawner.constructor, entitySpawner)
    }
  }

  preload() {
    for (const entity of this.entities.values()) {
      entity.preload(this.scene)
    }
  }

  spawn<T extends ConcreteEntityConstructor>(
    constructor: T,
    x: number,
    y: number,
    ...args: T extends new (s: any, x: any, y: any, ...rest: infer R) => any ? R : never
  ): InstanceType<T> {
    if (!this.entities.has(constructor)) {
      throw new Error(`Entity ${constructor.name} not registered`)
    }
    return new constructor(this.scene, x, y, ...args) as InstanceType<T>
  }
}
