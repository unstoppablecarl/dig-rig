import { Scenes } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { WeaponSingleFireInput } from '../../Input/InputController/WeaponInputControllers/WeaponSingleFireInput.ts'
import type { FireGroupWeapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { FloodFillProjectile } from '../../Projectiles/FloodFillProjectile.ts'
import type { ProjectileEffect } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import UPDATE = Scenes.Events.UPDATE

export class FloodFillWeapon extends WeaponSingleFireInput implements FireGroupWeapon {

  constructor(scene: GameLevel) {
    super(scene)
    this.binder.add(scene.events, UPDATE, this.update, this)
  }

  fire(effect: ProjectileEffect) {
    this.scene.projectiles.fireForPlayer(FloodFillProjectile, this.clampCharge(effect), effect)
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
