import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { ConcreteEntityConstructor, EntitySpawner } from './_Entity.types.ts'

export class EntityFactory extends SceneBound<GameLevel> {

  private entities = new Map<ConcreteEntityConstructor, EntitySpawner>()

  private byId = new Map<string, EntitySpawner>()

  register(entitySpawners: EntitySpawner[]) {
    for (const entitySpawner of entitySpawners) {
      this.entities.set(entitySpawner.constructor, entitySpawner)
      this.byId.set(entitySpawner.id, entitySpawner)
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

  spawnById(
    id: string,
    x: number,
    y: number,
    ...args: any[]
  ): any {
    if (!this.byId.has(id)) {
      throw new Error(`Entity id: ${id} not registered`)
    }
    const ctor = this.byId.get(id)?.constructor!

    return this.spawn(ctor, x, y, ...args)
  }

  get(id: string) {
    return this.byId.get(id)
  }

  getOptions() {
    return [...this.entities.values()].map(ent => ({
      value: ent.id,
      label: ent.displayName,
    }))
  }

  protected onDestroy() {
    super.onDestroy()
    this.entities.clear()
    this.byId.clear()
  }
}
