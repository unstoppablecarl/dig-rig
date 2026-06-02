import { throttle } from '../../../helpers/_helpers.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Weapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponSingleFireInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponSingleFireInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { FireMode } from '../_FireMode-types'

const BURST_SHOTS = 5
const BETWEEN_SHOTS_MS = 100
const THROTTLE_MS = BURST_SHOTS * BETWEEN_SHOTS_MS
const VELOCITY = 300
const CHARGE = 10

export class BurstWeapon extends WeaponSingleFireInput implements Weapon {
  readonly displayName = 'Burst'

  public fire: (mode: FireMode) => void

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)

    this.fire = throttle((mode: FireMode) => {
      this.fireBurst(mode)
    }, THROTTLE_MS)
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