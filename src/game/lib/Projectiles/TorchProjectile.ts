import { FireMode } from '../../config.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterExchanger, ParticleTarget, Position } from '../../types.ts'
import type { MatterTank } from '../Matter/MatterTank.ts'
import { BaseProjectile } from './BaseProjectile.ts'
import type { ProjectileManager } from './ProjectileManager.ts'

export type ProjectileSource = (MatterExchanger | Position) & ParticleTarget

export class TorchProjectile extends BaseProjectile {

  constructor(
    scene: GameLevel,
    manager: ProjectileManager,
    source: ProjectileSource,
    matterTank: MatterTank,
    x: number,
    y: number,
    tilesToModify: number,
    mode: FireMode,
  ) {
    super(
      scene,
      manager,
      source,
      matterTank,
      x,
      y,
      tilesToModify,
      mode,
    )
    this.setTilesToModify(tilesToModify)

    this.radius = 20
    scene.events.once('destroy', this.destroy, this)
  }

  update(dt: number) {
    this.renderer.update(this)
    if (!this.fired) return

    if (this.charge() > 0) {
      if (this.mode == FireMode.CREATE) {
        this.createTiles(this.charge())
      }

      if (this.mode == FireMode.DESTROY) {
        this.destroyTiles(this.charge())
      }
    }

    super.update(dt)
    if (!this.charge()) {
      this.destroy()
    }
  }
}