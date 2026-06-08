import type { Weapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { WeaponRapidFireInput } from '../../Input/InputController/WeaponManagerInput/WeaponRapidFireInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { FireMode } from '../_FireMode-types'

const RAPID_VELOCITY = 300

export class RapidWeapon extends WeaponRapidFireInput implements Weapon {
  rateOfFireMs = 100

  fire(mode: FireMode) {
    this.scene.projectiles.fireForPlayer(Projectile, this.clampCharge(mode), mode, RAPID_VELOCITY)
  }
}