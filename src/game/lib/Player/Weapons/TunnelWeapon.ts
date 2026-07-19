import { DESTROY_COLOR } from '../../../config/colors.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { WeaponConstantInput } from '../../Input/InputController/WeaponInputControllers/WeaponConstantInput.ts'
import type { Weapon } from '../../Input/InputController/WeaponManagerInput.ts'
import type { ProjectileEffect } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { ProjectileRenderer } from '../../Projectiles/ProjectileRenderer.ts'

const DESTROY_RADIUS = 20

export class TunnelWeapon extends WeaponConstantInput implements Weapon {
  private _destroyPos: Position = { x: 0, y: 0 }
  private destroyRenderer: ProjectileRenderer

  constructor(scene: GameLevel) {
    super(scene)
    this.destroyRenderer = new ProjectileRenderer(scene)
    this.destroyRenderer.setColor(DESTROY_COLOR.color)
    this.destroyRenderer.setRadius(DESTROY_RADIUS)
    this.destroyRenderer.setVisible(false)
  }

  getCharge(): number {
    return 0
  }

  updateFiring(value: boolean, _effect: ProjectileEffect): void {
    const bridge = this.scene.io.tunnelWeapon
    const player = this.scene.player

    bridge.playerX = player.x
    bridge.playerY = player.y

    const vel = player.container.body?.velocity
    const vx = vel?.x ?? 0
    const vy = vel?.y ?? 0
    const vlen = Math.sqrt(vx * vx + vy * vy)
    if (vlen > 1) {
      bridge.playerDirX = vx / vlen
      bridge.playerDirY = vy / vlen
    } else {
      const aim = player.getProjectileAngle()
      bridge.playerDirX = Math.cos(aim)
      bridge.playerDirY = Math.sin(aim)
    }

    const destroyPos = player.getProjectilePosition(0, this._destroyPos)
    if (!value) {
      bridge.destroyActive = 0
    }
    bridge.destroyX = destroyPos.x
    bridge.destroyY = destroyPos.y
    bridge.destroyRadius = DESTROY_RADIUS
    if (value) {
      bridge.destroyActive = 1
    }

    this.destroyRenderer.setVisible(value)
    if (value) {
      this.destroyRenderer.setPosition(destroyPos)
    }

  }

  protected onDisable() {
    super.onDisable()
    this.scene.io.tunnelWeapon.destroyActive = 0
  }

  protected onDestroy() {
    super.onDestroy()
  }
}
