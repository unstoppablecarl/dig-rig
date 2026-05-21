import { FireMode } from '../../../config.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { InstantWeapon } from './InstantWeapon.ts'

export class InstantWeaponDestroy extends InstantWeapon {
  readonly displayName = 'Instant Destroy'

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene, slot, FireMode.DESTROY)
  }
}