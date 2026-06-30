import { Math } from 'phaser'
import { MATTER_TANK_TEXT_STYLES } from '../../../config/styles.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { PhysicsBody } from '../../Collision/PhysicsBody.ts'
import { MatterTank } from '../../Matter/Tank/MatterTank.ts'
import type { EntitySpawner } from '../_Entity.types.ts'
import { Entity } from '../Entity.ts'
import Vector2 = Math.Vector2

export class PortableMatterTank extends Entity implements Position {
  static SPRITE_KEY = 'PORTABLE_MATTER_TANK'

  public matterTank: MatterTank

  readonly physicsBody: PhysicsBody
  private text: Phaser.GameObjects.DOMElement

  public x = 0
  public y = 0
  public prevPosition = new Vector2(0, 0)
  public maxVelocity = 0

  constructor(
    scene: GameLevel,
    x: number,
    y: number,
    startingMatter = 0,
    matterMax = Number.MAX_SAFE_INTEGER,
  ) {
    super(scene)

    this.x = x
    this.y = y
    this.matterTank = scene.matterManager.makeMatterTank(this, matterMax, startingMatter)

    const body = scene.matter.add.rectangle(x, y, 16, 27, {
      friction: 10000,
      frictionStatic: 10000,
      restitution: 0,
      density: 0.001,
    })

    this.physicsBody = PhysicsBody.makeFromContainer(scene, scene.add.container(x, y), body)
    scene.physicsBodyManager.add(this.physicsBody)

    const sprite = scene.add.sprite(0, 0, PortableMatterTank.SPRITE_KEY)
    this.physicsBody.gameObject.add(sprite)

    this.text = scene.add.dom(0, sprite.height * -0.5, 'div', MATTER_TANK_TEXT_STYLES).setOrigin(0.5, 1)
    this.physicsBody.gameObject.add(this.text)
  }

  update(_time: number, _delta: number): void {
    this.prevPosition.x = this.x
    this.prevPosition.y = this.y
    this.x = this.physicsBody.gameObject.x
    this.y = this.physicsBody.gameObject.y

    this.text.setText(`${this.matterTank.matterContained()}`)
  }

  protected onDestroy(): void {
    super.onDestroy()
    this.physicsBody.destroy()
    this.text.destroy()
    this.matterTank.destroy()
  }
}

export const PortableMatterTankSpawner: EntitySpawner<typeof PortableMatterTank> = {
  id: 'portable-matter-tank',
  constructor: PortableMatterTank,
  displayName: 'Portable Matter Tank',
  size: {
    w: 16,
    h: 27,
  },
  preload(scene: GameLevel) {
    scene.load.setPath('assets')
    scene.loadPixelImage(PortableMatterTank.SPRITE_KEY, 'portable-matter-tank.png')
  },
}