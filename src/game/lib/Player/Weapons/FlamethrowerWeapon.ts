import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { WeaponRapidFireInput } from '../../Input/InputController/WeaponInputControllers/WeaponRapidFireInput.ts'
import type { FireGroupWeapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { PLAYER_MATTER_TANK_ID } from '../../Matter/Tank/_MatterTank.types.ts'
import { ParticleType } from '../../Particles/_particle-types.ts'
import type { ProjectileEffect } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'

export class FlamethrowerWeapon extends WeaponRapidFireInput implements FireGroupWeapon {
  rateOfFireMs = 100

  constructor(scene: GameLevel) {
    super(scene)
  }

  _startPos: Position = { x: 0, y: 0 }

  setEnabled(value: boolean) {
    super.setEnabled(value)
    this.scene.previewProjectileRenderer.setVisible(value)
  }

  fire(_effect: ProjectileEffect) {
    const pos = this.scene.player.getProjectilePosition(0, this._startPos)
    const SPREAD_DEG = 15
    const angle = this.scene.player.getProjectileAngle() + (Math.random() - 0.5) * (SPREAD_DEG * Math.PI / 180)
    const velocity = 10
    const vx = Math.cos(angle) * velocity
    const vy = Math.sin(angle) * velocity
    this.scene.io.particleSpawns.queueParticleSpawn(ParticleType.FLAMETHROWER_BURST, pos.x, pos.y, PLAYER_MATTER_TANK_ID, vx, vy)
  }
}