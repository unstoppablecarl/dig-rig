import { FireMode } from '../../config.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterTank } from '../Matter/MatterTank.ts'
import { BaseProjectile, type ProjectileSource, radiusToTiles } from './BaseProjectile.ts'
import type { ProjectileManager } from './ProjectileManager.ts'

const MAX_RADIUS = 20

export class TunnelProjectile extends BaseProjectile {
  readonly mode = FireMode.DESTROY as const

  static MAX_TILES_TO_MOD = radiusToTiles(MAX_RADIUS)
  active = false
  fired = true

  constructor(
    scene: GameLevel,
    manager: ProjectileManager,
    source: ProjectileSource,
    matterTank: MatterTank,
    x: number,
    y: number,
  ) {
    super(
      scene,
      manager,
      source,
      matterTank,
      x,
      y,
      FireMode.DESTROY,
    )

    this.radius = MAX_RADIUS
    // this.tilesToModify = TunnelProjectile.MAX_TILES_TO_MOD
    this.renderer.queueReRender()
  }

  setTilesToModify(): boolean {
    return false
  }

  recharge() {
    this.tilesModified = 0
    this.tilesToModify = this.matterTank.chargeAvailable(FireMode.DESTROY)
    this.matterTank.addPendingCharge(FireMode.DESTROY, this.tilesToModify)
  }

  fire() {
    this.recharge()
  }

  update() {
    this.renderer.setVisible(this.active)
    if (!this.active) return
    this.renderer.update(this)

    const charge = this.charge()
    if (charge > 0) {
      this.destroyTiles(charge)
    } else {
      this.recharge()
    }
  }
}