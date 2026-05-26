import { FireMode } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { ImmediateWeapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponRapidFireInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponRapidFireInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'

const BETWEEN_SHOTS_MS = 100
const RAPID_CHARGE = 100
const RAPID_VELOCITY = 300

export class RapidWeapon extends SceneBound implements ImmediateWeapon {
  readonly displayName = 'Rapid'

  private input: WeaponRapidFireInput

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.input = new WeaponRapidFireInput(scene, this, BETWEEN_SHOTS_MS)
  }

  fire(mode: FireMode) {
    this.scene.projectiles.fireForPlayer(Projectile, RAPID_CHARGE, mode, RAPID_VELOCITY)
  }

  get enabled() {
    return this.input.enabled
  }

  setEnabled(value: boolean) {
    this.input.setInputEnabled(value)
  }

  protected onDestroy() {
    this.input.destroy()
  }
}