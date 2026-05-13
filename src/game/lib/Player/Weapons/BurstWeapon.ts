import { FireMode } from '../../../config.ts'
import { throttle } from '../../../helpers/_helpers.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { PlayerWeaponSingleFireInput } from '../../Input/PlayerWeaponSingleFireInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import type { ImmediateWeapon } from './PlayerWeaponManager.ts'

const BURST_SHOTS = 5
const BETWEEN_SHOTS_MS = 100
const THROTTLE_MS = BURST_SHOTS * BETWEEN_SHOTS_MS
const VELOCITY = 300
const CHARGE = 10

export class BurstWeapon extends SceneBound implements ImmediateWeapon {
  private input: PlayerWeaponSingleFireInput
  public fire: (mode: FireMode) => void
  public displayName = 'Burst'

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.input = new PlayerWeaponSingleFireInput(scene, this)

    this.fire = throttle((mode: FireMode) => {
      this.fireBurst(mode)
    }, THROTTLE_MS)
  }

  get enabled() {
    return this.input.enabled
  }

  setEnabled(value: boolean) {
    this.input.setInputEnabled(value)
  }

  fireBurst(mode: FireMode) {
    this.fireOnce(mode)

    this.scene.time.addEvent({
      delay: BETWEEN_SHOTS_MS,
      callback: () => this.fireOnce(mode),
      repeat: BURST_SHOTS - 2,
    })
  }

  fireOnce(mode: FireMode) {
    this.scene.projectiles.fireForPlayer(Projectile, CHARGE, mode, VELOCITY)
  }
}