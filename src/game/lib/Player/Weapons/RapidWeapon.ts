import { INPUT_ACTIONS } from '../../../../input.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Weapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponRapidFireInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponRapidFireInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { FireMode } from '../_FireMode-types'

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

  uiStatusControls() {
    const group = this.scene.playerWeaponManager.fireGroup
    const prev = INPUT_ACTIONS.PREV_FIRE_MODE.join(',')
    const next = INPUT_ACTIONS.NEXT_FIRE_MODE.join(',')
    return `Group: ${FireMode[group.primary()]} / ${FireMode[group.secondary()]} [${prev}] / [${next}] = cycle`
  }

  fire(mode: FireMode) {
    this.scene.projectiles.fireForPlayer(Projectile, RAPID_CHARGE, mode, RAPID_VELOCITY)
  }
}