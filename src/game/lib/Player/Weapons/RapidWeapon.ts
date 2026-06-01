import { FireMode } from '../../../config.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Weapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponRapidFireInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponRapidFireInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'

const RAPID_CHARGE = 100
const RAPID_VELOCITY = 300

export class RapidWeapon extends WeaponRapidFireInput implements Weapon {
  readonly displayName = 'Rapid'

  rateOfFireMs = 100

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
  }

  fire(mode: FireMode) {
    this.scene.projectiles.fireForPlayer(Projectile, RAPID_CHARGE, mode, RAPID_VELOCITY)
  }
}