import { FireMode } from '../../../config.ts'
import { throttle } from '../../../helpers/_helpers.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { PlayerWeaponRapidFireInput } from '../../Input/PlayerWeaponRapidFireInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import type { ImmediateWeapon } from './PlayerWeaponManager.ts'

const BETWEEN_SHOTS_MS = 100
const RAPID_CHARGE = 100
const RAPID_VELOCITY = 300

export class RapidWeapon extends SceneBound implements ImmediateWeapon {
  readonly displayName = 'Rapid'

  private input: PlayerWeaponRapidFireInput
  public fire: (mode: FireMode) => void

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.input = new PlayerWeaponRapidFireInput(scene, this)

    this.fire = throttle((mode: FireMode) => {
      this.scene.projectiles.fireForPlayer(Projectile, RAPID_CHARGE, mode, RAPID_VELOCITY)
    }, BETWEEN_SHOTS_MS)
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