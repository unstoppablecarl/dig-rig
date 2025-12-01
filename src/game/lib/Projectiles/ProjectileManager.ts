import { FireMode } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterTank } from '../Matter/MatterTank.ts'
import type { BaseProjectile, BaseProjectileConstructor } from './BaseProjectile.ts'
import { Projectile, type ProjectileSource } from './Projectile.ts'

export class ProjectileManager extends SceneBound {
  public children: BaseProjectile[] = []

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
  }

  fireForPlayer(
    charge: number,
    mode: FireMode,
    velocity?: number,
  ): Projectile | undefined;

  fireForPlayer<T extends BaseProjectile>(
    charge: number,
    mode: FireMode,
    velocity: number | undefined,
    ctor: BaseProjectileConstructor<T>,
  ): T | undefined;

  fireForPlayer(charge: number, mode: FireMode, velocity?: number, Constructor: BaseProjectileConstructor<BaseProjectile> = Projectile,
  ) {
    const player = this.scene.player
    if (!player.matterTank.hasChargeAvailable(charge, mode)) {
      console.log('Not enough charge!')
      return
    }
    const pos = player.getProjectilePosition()
    const angle = player.getProjectileAngle()

    const projectile = this.add(pos.x, pos.y, player, player.matterTank, charge, mode, Constructor)

    projectile.fire(angle, velocity)

    return projectile
  }

  add(
    x: number,
    y: number,
    source: ProjectileSource,
    matterTank: MatterTank,
    charge: number,
    mode: FireMode,
  ): Projectile;

  add<T extends BaseProjectile>(
    x: number,
    y: number,
    source: ProjectileSource,
    matterTank: MatterTank,
    charge: number,
    mode: FireMode,
    ctor: BaseProjectileConstructor<T>,
  ): T;

  add<T extends BaseProjectile>(
    x: number,
    y: number,
    source: ProjectileSource,
    matterTank: MatterTank,
    charge: number,
    mode: FireMode,
    Constructor: BaseProjectileConstructor<BaseProjectile> = Projectile,
  ): T {
    const projectile = new Constructor(
      this.scene,
      this,
      source,
      matterTank,
      x,
      y,
      charge,
      mode,
    ) as T
    this.children.push(projectile)
    return projectile
  }

  update(dt: number) {
    for (let c of this.children) {
      c.update(dt)
    }
  }

  remove(projectile: BaseProjectile) {
    this.children = this.children.filter(p => p !== projectile)
  }

  destroy() {
    super.destroy()

    // @ts-expect-error: destroy
    this.children = null
  }
}