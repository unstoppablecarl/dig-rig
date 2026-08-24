import { FireMode } from '../../../config.ts'
import { throttle } from '../../../helpers/_helpers.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { WeaponRapidFireInput } from '../../Input/InputController/WeaponInputControllers/WeaponRapidFireInput.ts'
import type { FireGroupWeapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import type { ProjectileEffect } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'

const RAPID_VELOCITY = 200

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

  fire(effect: ProjectileEffect) {
    this.scene.projectiles.fireForPlayer(Projectile, this.clampCharge(effect), effect, RAPID_VELOCITY)
  }
}