import { FireMode, FireModeValues } from '../../../config.ts'
import { FIRE_MODE_COLORS } from '../../../config/colors.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { GameEvent } from '../../events.ts'
import type { Weapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponRapidFireInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponRapidFireInput.ts'
import { MatterType, MatterTypeValues } from '../../Matter/_Matter-types.ts'
import { InstantProjectile } from '../../Projectiles/InstantProjectile.ts'
import { tilesToRadius } from '../../Projectiles/projectile-radius'
import { ProjectileRenderer } from '../../Projectiles/ProjectileRenderer.ts'

const MIN_CHARGE = 10
const COLLISION_TYPES = new Set(MatterTypeValues.filter(v => v !== MatterType.EMPTY))

export class InstantWeapon extends WeaponRapidFireInput implements Weapon {
  readonly displayName = 'Instant'

  private renderer: ProjectileRenderer

  private charge: number = -1

  private targetPos: Position
  private fireMode: PlayerFireModeState
  rateOfFireMs = 50

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.fireMode = new PlayerFireModeState()

    this.renderer = new ProjectileRenderer(scene)
    this.renderer.setColor(FIRE_MODE_COLORS[this.fireMode.value()])

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a.CHARGE_DECREASE.onDown(() => this.decreaseCharge()),
      a.CHARGE_INCREASE.onDown(() => this.increaseCharge()),
      a.PREV_FIRE_MODE.onDown(() => {
        this.fireMode.prev()
        this.onFireModeChange()
      }),
      a.NEXT_FIRE_MODE.onDown(() => {
        this.fireMode.next()
        this.onFireModeChange()
      }),
    ])
  }

  fire() {
    const available = this.clampCharge()
    this.scene.projectiles.fireForPlayer(InstantProjectile, available, this.fireMode.value(), 0, this.targetPos, 0, null)
  }

  onFireModeChange(): void {
    this.renderer.setColor(FIRE_MODE_COLORS[this.fireMode.value()])
    this.scene.EVENTS.emit(GameEvent.UI_WEAPON_UPDATE, this)
  }

  setEnabled(value: boolean) {
    super.setEnabled(value)
    if (value) {
      this.setCharge(2000)
    }
    this.renderer.setVisible(value)
  }

  _playerArmPos: Position = { x: 0, y: 0 }

  update(_time: number, delta: number): void {
    super.update(_time, delta)
    const armPosition = this.scene.player.getProjectilePosition(0, this._playerArmPos)
    const armAngle = this.scene.player.getProjectileAngle()
    this.targetPos = this.scene.tilemap.getAngleRayCollision(armPosition.x, armPosition.y, armAngle, COLLISION_TYPES)

    this.renderer.setPosition(this.targetPos)
    this.clampCharge()
  }

  increaseCharge(): void {
    const changed = this.setCharge(this.charge + 100)
    if (!changed) {
      this.scene.EVENTS.emit(GameEvent.MESSAGE, 'Max Available in Matter Tank')
    }
  }

  decreaseCharge(): void {
    this.setCharge(this.charge - 100)
  }

  getSuffix(): string {
    return ` | charge: ${this.charge}, radius: ${Math.round(this.renderer.radius)} Q/E keys change charge | Mode: ${FireMode[this.fireMode.value()]} R/F keys change mode`
  }

  protected setCharge(val: number): boolean {
    val = Math.max(MIN_CHARGE, val)
    const mode = this.fireMode.value()
    const charge = this.scene.player.matterTank.clampToChargeAvailable(val, mode)
    if (charge === this.charge) return false
    this.charge = charge
    const radius = tilesToRadius(charge)
    this.renderer.setRadius(radius)

    this.scene.EVENTS.emit(GameEvent.UI_WEAPON_UPDATE, this)

    return true
  }

  protected clampCharge() {
    this.setCharge(this.charge)
    return this.charge
  }

  protected onDestroy() {
    super.onDestroy()
    this.renderer.destroy()
    // @ts-expect-error: destroy
    this.renderer = null
    // @ts-expect-error: destroy
    this.fireMode = null
  }
}

export class PlayerFireModeState {
  private index = 0
  private _fireMode: FireMode

  constructor(mode: FireMode = FireMode.DESTROY) {
    this.set(mode)
  }

  value() {
    return this._fireMode
  }

  set(fireMode: FireMode) {
    this._fireMode = fireMode
    this.index = FireModeValues.indexOf(fireMode)
  }

  prev() {
    let index: number
    if (this.index === 0) {
      index = FireModeValues.length - 1
    } else {
      index = this.index - 1
    }
    this.set(FireModeValues[index])
    return this._fireMode
  }

  next() {
    let index: number
    if (this.index === FireModeValues.length - 1) {
      index = 0
    } else {
      index = this.index + 1
    }
    this.set(FireModeValues[index])
    return this._fireMode
  }
}