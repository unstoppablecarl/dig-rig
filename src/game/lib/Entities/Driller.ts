import { GameObjects, Math as PMath, Time } from 'phaser'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { ParticleTarget } from '../../types.ts'
import { MatterTank } from '../Matter/MatterTank/MatterTank.ts'
import { FireMode } from '../Player/_FireMode-types'
import { Projectile } from '../Projectiles/Projectile.ts'
import Container = GameObjects.Container
import GameObject = GameObjects.GameObject
import Vector2 = PMath.Vector2
import TimerEvent = Time.TimerEvent

export class Driller extends GameObject implements ParticleTarget {
  public matterTank: MatterTank

  public x = 0
  public y = 0

  public prevPosition = new Vector2(0, 0)
  public maxVelocity = 20

  private container: Container
  private timer: TimerEvent
  private text: GameObjects.DOMElement

  constructor(
    public scene: GameLevel,
    private fireRateMs = 500,
    private projectileCharge = 100,
    private matterMax = 300,
  ) {
    super(scene, 'Driller')
    this.matterTank = scene.matterManager.makeMatterTank(this.matterMax, 0)
    this.container = scene.add.container()

    const sprite = scene.add.sprite(0, 0, 'enemy')
    this.container.add(sprite)

    this.text = scene.add.dom(0, sprite.height)
      .createFromHTML('<div/>')
    this.text.node.classList.add('matter-tank-text')

    this.container.add(this.text)
    scene.layers.enemies.add(this.container)

    this.timer = this.scene.time.addEvent({
      delay: this.fireRateMs,
      loop: true,
      callback: this.attemptFire,
      callbackScope: this,
    })
  }

  update(_time: number, _delta: number): void {
    this.prevPosition.x = this.x
    this.prevPosition.y = this.y
    this.container.setPosition(this.x, this.y)

    this.x += 0.1

    const matterMax = this.matterTank.matterMax
    const current = this.matterTank.matterContained()

    this.text.setText(`${current}/${matterMax}`)
  }

  private queue(charge: number, mode: FireMode) {
    return this.scene.projectiles.add(Projectile, this, this.matterTank, this.x, this.y, charge, mode)
  }

  private attemptFire() {
    const matterTank = this.matterTank

    if (matterTank.full()) {
      if (matterTank.getPendingCharge(FireMode.CREATE) > 0) return
      this.queue(this.projectileCharge, FireMode.CREATE)
        .fireRaw(0, 1)

      return
    }

    if (matterTank.getPendingCharge(FireMode.DESTROY) > 0) return
    if (matterTank.chargeAvailable(FireMode.DESTROY) >= this.projectileCharge) {
      this.queue(this.projectileCharge, FireMode.DESTROY)
        .fireRaw(0, 1)
    }
  }

  public destroy(fromScene = true) {
    this.container.destroy()
    this.timer.destroy()
    this.text.destroy()
    this.matterTank.destroy()

    // @ts-expect-error destroy
    this.scene = null
    // @ts-expect-error destroy
    this.prevPosition = null
    // @ts-expect-error destroy
    this.matterTank = null
    // @ts-expect-error destroy
    this.container = null
    // @ts-expect-error destroy
    this.timer = null
    // @ts-expect-error destroy
    this.text = null

    super.destroy(fromScene)
  }
}