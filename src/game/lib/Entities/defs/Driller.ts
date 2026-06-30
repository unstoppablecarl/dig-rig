import { GameObjects, Math as PMath, Time } from 'phaser'
import { MATTER_TANK_TEXT_STYLES } from '../../../config/styles.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { ParticleTarget } from '../../../types.ts'
import { MatterTank } from '../../Matter/Tank/MatterTank.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import type { ProjectileEffect } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { PROJECTILE_EFFECT } from '../../Projectiles/ProjectileEffect/ProjectileEffect.ts'
import type { EntitySpawner } from '../_Entity.types.ts'
import { Entity } from '../Entity.ts'
import Vector2 = PMath.Vector2
import TimerEvent = Time.TimerEvent

export class Driller extends Entity implements ParticleTarget {
  static SPRITE_KEY = 'DRILLER'

  static SPAWNER: EntitySpawner<typeof Driller> = {
    id: 'driller',
    constructor: Driller,
    displayName: 'Driller',
    size: {
      w: 18,
      h: 18,
    },
    preload(scene: GameLevel) {
      scene.load.setPath('assets')
      scene.loadPixelImage(Driller.SPRITE_KEY, 'enemy.png')
    },
  }

  public matterTank: MatterTank

  public x = 0
  public y = 0
  public prevPosition = new Vector2(0, 0)
  public maxVelocity = 20

  private container: GameObjects.Container
  private timer: TimerEvent
  private text: GameObjects.DOMElement

  constructor(
    scene: GameLevel,
    x: number,
    y: number,
    private fireRateMs = 500,
    private projectileCharge = 100,
    private matterMax = 300,
  ) {
    super(scene)
    this.matterTank = scene.matterManager.makeMatterTank(this, this.matterMax, 0)
    this.container = scene.add.container(x, y)

    this.x = x
    this.y = y
    const sprite = scene.add.sprite(0, 0, Driller.SPRITE_KEY)
    this.container.add(sprite)

    this.text = scene.add.dom(0, sprite.height, 'div', MATTER_TANK_TEXT_STYLES)
    this.container.add(this.text)
    scene.layers.enemies.add(this.container)

    this.timer = scene.time.addEvent({
      delay: this.fireRateMs,
      loop: true,
      callback: this.attemptFire,
      callbackScope: this,
    })

    this.scene.entityManager.add(this)
  }

  update(_time: number, _delta: number): void {
    this.prevPosition.x = this.x
    this.prevPosition.y = this.y
    this.container.setPosition(this.x, this.y)

    this.x += 0.1

    this.text.setText(`${this.matterTank.matterContained()}/${this.matterTank.matterMax}`)
  }

  private queue(charge: number, effect: ProjectileEffect) {
    return this.scene.projectiles.add(Projectile, this.matterTank, this.x, this.y, charge, effect)
  }

  private attemptFire() {
    const matterTank = this.matterTank
    if (matterTank.full()) {
      if (matterTank.getPendingCharge(FireMode.CREATE) > 0) return
      this.queue(this.projectileCharge, PROJECTILE_EFFECT.CREATE_SOLID)?.fireRaw(0, 1)
      return
    }
    if (matterTank.getPendingCharge(FireMode.DESTROY) > 0) return
    if (matterTank.chargeAvailable(FireMode.DESTROY) >= this.projectileCharge) {
      this.queue(this.projectileCharge, PROJECTILE_EFFECT.DESTROY)?.fireRaw(0, 1)
    }
  }

  protected onDestroy(): void {
    super.onDestroy()
    this.container.destroy()
    this.timer.destroy()
    this.text.destroy()
    this.matterTank.destroy()
  }
}
