import { GameObjects } from 'phaser'
import { MATTER_TANK_TEXT_STYLES } from '../../config/styles.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import { PhysicsBody } from '../Collision/PhysicsBody.ts'
import { MatterTank } from '../Matter/Tank/MatterTank.ts'
import Container = GameObjects.Container
import GameObject = GameObjects.GameObject
import Vector2 = Phaser.Math.Vector2

export class PortableMatterTank extends GameObject implements Position {
  static SPRITE_KEY = 'PORTABLE_MATTER_TANK'
  public matterTank: MatterTank

  readonly container: Container
  private text: GameObjects.DOMElement

  public prevPosition = new Vector2(0, 0)
  public maxVelocity = 0
  readonly physicsBody: PhysicsBody

  constructor(
    public scene: GameLevel,
    public x: number,
    public y: number,
    startingMatter = 0,
    matterMax = Number.MAX_SAFE_INTEGER,
  ) {
    super(scene, 'Portable Matter Tank')

    this.matterTank = scene.matterManager.makeMatterTank(this, matterMax, startingMatter)
    const width = 16
    const height = 27

    const body = scene.matter.add.rectangle(x, y, width, height, {
      friction: 10000,
      frictionStatic: 10000,
      restitution: 0,
      density: 0.001,
    })

    this.physicsBody = PhysicsBody.makeFromContainer(this.scene, this.scene.add.container(this.x, this.y), body)
    this.scene.physicsBodyManager.add(this.physicsBody)

    this.container = this.physicsBody.gameObject

    const sprite = scene.add.sprite(0, 0, PortableMatterTank.SPRITE_KEY)
    this.container.add(sprite)

    this.text = scene.add.dom(0, sprite.height * -.5, 'div', MATTER_TANK_TEXT_STYLES)
      .setOrigin(0.5, 1)

    this.container.add(this.text)
  }

  update(_time: number, _delta: number): void {
    this.prevPosition.x = this.x
    this.prevPosition.y = this.y
    this.x = this.container.x
    this.y = this.container.y

    const current = this.matterTank.matterContained()

    this.text.setText(`${current}`)
  }

  public destroy(fromScene = true) {
    this.container.destroy()
    this.text?.destroy()
    this.matterTank.destroy()

    // @ts-expect-error destroy
    this.scene = null
    // @ts-expect-error destroy
    this.matterTank = null
    // @ts-expect-error destroy
    this.container = null
    // @ts-expect-error destroy
    this.text = null

    super.destroy(fromScene)
  }
}