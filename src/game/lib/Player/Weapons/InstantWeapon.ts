import { FIRE_MODE_COLORS } from '../../../config/colors.ts'
import { isMatterTankFireMode } from '../../../helpers/_helpers.ts'
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
  private renderer: ProjectileRenderer

  private charge: number = -1

  private targetPos: Position
  rateOfFireMs = 100

  constructor(scene: GameLevel) {
    super(scene)

    this.renderer = new ProjectileRenderer(scene)
    this.renderer.setColor(FIRE_MODE_COLORS[this.scene.instantWeaponUIState.fireMode])

    const a = this.scene.playerActions
    this.binder.addInputHoldRepeat(a.CHARGE_DECREASE, () => this.adjustCharge(-100))
    this.binder.addInputHoldRepeat(a.CHARGE_INCREASE, () => this.adjustCharge(100))
    this.binder.addInput(() => [
      a.PREV_MODE.onDown(() => {
        this.scene.instantWeaponUIState.prevFireMode()
        this.renderer.setColor(this.scene.instantWeaponUIState.fireModeColor)
      }),
      a.NEXT_MODE.onDown(() => {
        this.scene.instantWeaponUIState.nextFireMode()
        this.renderer.setColor(this.scene.instantWeaponUIState.fireModeColor)
      }),
    ])
  }

  fire() {
    const available = this.clampCharge()
    this.scene.projectiles.fireForPlayer(InstantProjectile, available, this.scene.instantWeaponUIState.fireMode, 0, this.targetPos, 0, null)
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

  onMouseWheel(deltaY: number): boolean {
    this.adjustCharge(Math.round(deltaY * -10))
    return true
  }

  adjustCharge(value: number): void {
    const changed = this.setCharge(this.charge + value)
    if (value > 0 && !changed) {
      this.scene.EVENTS.emit(GameEvent.MESSAGE, 'Max Available in Matter Tank')
    }
  }

  protected setCharge(val: number): boolean {
    val = Math.max(MIN_CHARGE, val)
    const mode = this.scene.instantWeaponUIState.fireMode
    let charge = val
    if (isMatterTankFireMode(mode)) {
      charge = this.scene.player.matterTank.clampToChargeAvailable(val, mode)
    }
    if (charge === this.charge) return false
    this.charge = charge
    const radius = tilesToRadius(charge)
    this.renderer.setRadius(radius)

    this.scene.instantWeaponUIState.charge = this.charge

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