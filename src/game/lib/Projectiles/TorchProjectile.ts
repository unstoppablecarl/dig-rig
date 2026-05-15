import { FireMode } from '../../config.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterTank } from '../Matter/MatterTank.ts'
import { BaseProjectile, type ProjectileSource } from './BaseProjectile.ts'
import type { ProjectileManager } from './ProjectileManager.ts'

export class TorchProjectile extends BaseProjectile {

  constructor(
    scene: GameLevel,
    manager: ProjectileManager,
    source: ProjectileSource,
    matterTank: MatterTank,
    x: number,
    y: number,
    mode: FireMode,
  ) {
    super(
      scene,
      manager,
      source,
      matterTank,
      x,
      y,
      mode,
    )

    this.radius = 20
  }

  update(dt: number) {
    this.renderer.update(this)
    if (!this.fired) return

    if (this.charge() > 0) {
      if (this.mode === FireMode.CREATE) {
        this.createTiles(this.charge())
      } else if (this.mode === FireMode.DESTROY) {
        this.destroyTiles(this.charge())
      }
    }

    super.update(dt)
    if (!this.charge()) {
      this.destroy()
    }
  }
}