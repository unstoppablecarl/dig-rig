import type { Weapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponRapidFireInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponRapidFireInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { FireMode } from '../_FireMode-types'

const RAPID_CHARGE = 100
const RAPID_VELOCITY = 300

export class RapidWeapon extends WeaponRapidFireInput implements Weapon {
  rateOfFireMs = 100

  fire(mode: FireMode) {
    this.scene.projectiles.fireForPlayer(Projectile, RAPID_CHARGE, mode, RAPID_VELOCITY)
  }
}