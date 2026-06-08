import { Scenes } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { WeaponSingleFireInput } from '../../Input/InputController/WeaponInputControllers/WeaponSingleFireInput.ts'
import type { FireGroupWeapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { Projectile } from '../../Projectiles/Projectile.ts'
import { FireMode } from '../_FireMode-types'
import UPDATE = Scenes.Events.UPDATE

export class BasicWeapon extends WeaponSingleFireInput implements FireGroupWeapon {

  constructor(scene: GameLevel) {
    super(scene)
    this.binder.add(scene.events, UPDATE, this.update, this)
  }

  fire(mode: FireMode) {
    this.scene.projectiles.fireForPlayer(Projectile, this.clampCharge(mode), mode)
  }

  setEnabled(value: boolean) {
    super.setEnabled(value)
    this.scene.previewProjectileRenderer.setVisible(value)
  }

  _startPos: Position = { x: 0, y: 0 }

  update(_time: number, _delta: number) {
    const player = this.scene.player
    const startPos = player.getProjectilePosition(0, this._startPos)

    this.scene.previewProjectileRenderer.setPosition(startPos)
  }
}