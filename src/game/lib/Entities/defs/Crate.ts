import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { PhysicsBody } from '../../Collision/PhysicsBody.ts'
import type { EntitySpawner } from '../_Entity.types.ts'
import { Entity } from '../Entity.ts'

export class Crate extends Entity {
  static SPRITE_KEY = 'CRATE'
  static SPAWNER: EntitySpawner<typeof Crate> = {
    id: 'crate',
    constructor: Crate,
    displayName: 'Crate',
    size: {
      w: 20,
      h: 20,
    },
    preload(scene: GameLevel) {
      scene.load.setPath('assets')
      scene.loadPixelImage(Crate.SPRITE_KEY, 'crate.png')
    },
  }

  readonly physicsBody: PhysicsBody

  constructor(
    scene: GameLevel,
    x: number,
    y: number,
  ) {
    super(scene)

    this.scene.entityManager.add(this)

    const body = scene.matter.add.rectangle(x, y, 20, 20, {
      friction: 10000,
      frictionStatic: 10000,
      restitution: 0,
      density: 0.001,
    })

    this.physicsBody = PhysicsBody.makeFromContainer(scene, scene.add.container(x, y), body)
    scene.physicsBodyManager.add(this.physicsBody)

    const sprite = scene.add.sprite(0, 0, Crate.SPRITE_KEY)
    this.physicsBody.gameObject.add(sprite)
  }

  update(_time: number, _delta: number) {
  }

  protected onDestroy(): void {
    super.onDestroy()
    this.physicsBody.destroy()
  }
}