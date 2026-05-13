import { FireMode } from '../../config.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterExchanger, ParticleTarget, Position } from '../../types.ts'
import { MatterTank } from '../Matter/MatterTank.ts'
import type { TunnelWeapon } from '../Player/Weapons/TunnelWeapon.ts'
import { BaseProjectile, radiusToTiles, tilesToRadius } from './BaseProjectile.ts'
import type { ProjectileManager } from './ProjectileManager.ts'

export type ProjectileSource = (MatterExchanger | Position) & ParticleTarget

const MAX_RADIUS = 20

export class TunnelProjectile extends BaseProjectile {
  readonly mode = FireMode.DESTROY as const

  static MAX_TILES_TO_MOD = radiusToTiles(MAX_RADIUS)

  public weapon: TunnelWeapon | null = null

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

    scene.events.once('destroy', this.destroy, this)
  }

  setTilesToModify(count: number): boolean {
    count = Math.min(TunnelProjectile.MAX_TILES_TO_MOD, count)

    const changed = super.setTilesToModify(count)
    if (changed) {
      this.radius = tilesToRadius(count)
      this.renderer.queueReRender()
    }

    return changed
  }

  update(dt: number) {
    this.renderer.update(this)
    if (!this.fired) return
    if (this.charge() > 0) {
      this.weapon!.destroyedTilesToTransfer += this.destroyTiles(this.charge())
    }

    super.update(dt)
    if (!this.charge()) {
      this.destroy()
    }
  }
}