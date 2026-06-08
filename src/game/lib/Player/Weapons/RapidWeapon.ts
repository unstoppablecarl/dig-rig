import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { WeaponRapidFireInput } from '../../Input/InputController/WeaponInputControllers/WeaponRapidFireInput.ts'
import type { FireGroupWeapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { FireMode } from '../_FireMode-types'

const RAPID_VELOCITY = 300

export class RapidWeapon extends WeaponRapidFireInput implements FireGroupWeapon {
  rateOfFireMs = 100

  constructor(scene: GameLevel) {
    super(scene)
  }

  _startPos: Position = { x: 0, y: 0 }

  update(_time: number, delta: number) {
    super.update(_time, delta)

    const player = this.scene.player
    const startPos = player.getProjectilePosition(0, this._startPos)

    this.scene.previewProjectileRenderer.setPosition(startPos)
  }

  setEnabled(value: boolean) {
    super.setEnabled(value)
    this.scene.previewProjectileRenderer.setVisible(value)
  }

  fire(mode: FireMode) {
    this.scene.projectiles.fireForPlayer(Projectile, this.clampCharge(mode), mode, RAPID_VELOCITY)
  }
}