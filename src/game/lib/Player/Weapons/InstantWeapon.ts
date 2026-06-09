import { computed } from 'vue'
import { isMatterTankFireMode } from '../../../helpers/_helpers.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { WeaponRapidFireInput } from '../../Input/InputController/WeaponInputControllers/WeaponRapidFireInput.ts'
import type { Weapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { InstantProjectile } from '../../Projectiles/InstantProjectile.ts'
import { EFFECT_BY_FIRE_MODE } from '../../Projectiles/ProjectileEffect/ProjectileEffect.ts'
import { ProjectileRenderer } from '../../Projectiles/ProjectileRenderer.ts'

export class InstantWeapon extends WeaponRapidFireInput implements Weapon {
  private renderer: ProjectileRenderer

  private targetPos: Position
  rateOfFireMs = 100

  constructor(scene: GameLevel) {
    super(scene)

    const charge = computed(() => {
      const mode = this.scene.instantWeaponUIState.fireMode
      let val = this.scene.weaponUIState.charge
      if (isMatterTankFireMode(mode) && this.scene.player) {
        val = this.scene.player.matterTank.clampToChargeAvailable(val, mode)
      }
      return val
    })

    this.renderer = new ProjectileRenderer(scene, () => scene.instantWeaponUIState.fireModeColor, charge)

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a.PREV_MODE.onDown(() => {
        this.scene.instantWeaponUIState.prevFireMode()
      }),
      a.NEXT_MODE.onDown(() => {
        this.scene.instantWeaponUIState.nextFireMode()
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
    const COLLISION_TYPES = EFFECT_BY_FIRE_MODE[this.getFireMode()].reactsWithMatterTypes
    this.targetPos = this.scene.tilemap.getAngleRayCollision(armPosition.x, armPosition.y, armAngle, COLLISION_TYPES)

    this.renderer.setPosition(this.targetPos)
  }

  getCharge(): number {
    return this.scene.weaponUIState.charge
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