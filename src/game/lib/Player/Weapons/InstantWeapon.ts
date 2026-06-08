import { FIRE_MODE_COLORS } from '../../../config/colors.ts'
import { isMatterTankFireMode } from '../../../helpers/_helpers.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import type { Weapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { WeaponRapidFireInput } from '../../Input/InputController/WeaponManagerInput/WeaponRapidFireInput.ts'
import { MatterType, MatterTypeValues } from '../../Matter/_Matter-types.ts'
import { InstantProjectile } from '../../Projectiles/InstantProjectile.ts'
import { tilesToRadius } from '../../Projectiles/projectile-radius'
import { ProjectileRenderer } from '../../Projectiles/ProjectileRenderer.ts'

const COLLISION_TYPES = new Set(MatterTypeValues.filter(v => v !== MatterType.EMPTY))

export class InstantWeapon extends WeaponRapidFireInput implements Weapon {
  private renderer: ProjectileRenderer

  private targetPos: Position
  rateOfFireMs = 100

  constructor(scene: GameLevel) {
    super(scene)

    this.renderer = new ProjectileRenderer(scene)
    this.renderer.setColor(FIRE_MODE_COLORS[this.getFireMode()])

    const a = this.scene.playerActions
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
    let charge = this.clampCharge(this.getFireMode())
    this.scene.projectiles.fireForPlayer(InstantProjectile, charge, this.getFireMode(), 0, this.targetPos, 0, null)
  }

  getFireMode() {
    return this.scene.instantWeaponUIState.fireMode
  }

  setEnabled(value: boolean) {
    super.setEnabled(value)
    if (value) {
      this.setCharge(this.scene.weaponUIState.charge)
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
  }

  protected getCharge(): number {
    return this.scene.weaponUIState.charge
  }

  protected setCharge(val: number): boolean {
    if (super.setCharge(val)) {
      this.onChargeChanged()
      return true
    }

    return false
  }

  private onChargeChanged() {
    const mode = this.getFireMode()
    let val = this.getCharge()
    if (isMatterTankFireMode(mode)) {
      val = this.scene.player.matterTank.clampToChargeAvailable(val, mode)
    }
    const radius = tilesToRadius(val)
    this.renderer.setRadius(radius)
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