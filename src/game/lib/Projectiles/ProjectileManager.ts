import { isMatterTankFireMode } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import type { MatterTank } from '../Matter/MatterTank/MatterTank.ts'
import type { BaseProjectile, BaseProjectileConstructor } from './BaseProjectile.ts'
import type { ProjectileEffect } from './ProjectileEffect/_ProjectileEffect.types.ts'
import type { ProjectileRenderer } from './ProjectileRenderer.ts'
import { ProjectileRendererPool } from './ProjectileRendererPool.ts'

export class ProjectileManager extends SceneBound {
  public children: BaseProjectile[] = []
  private rendererPool: ProjectileRendererPool

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.rendererPool = new ProjectileRendererPool(scene)
  }

  add<T extends BaseProjectile>(
    Constructor: BaseProjectileConstructor<T>,
    matterTank: MatterTank,
    x: number,
    y: number,
    charge: number,
    effect: ProjectileEffect,
    renderer: null | ProjectileRenderer = this.rendererPool.acquire(),
  ): T {
    const projectile = new Constructor(this.scene, this, matterTank, x, y, effect, renderer)

    projectile.setTilesToModify(charge)
    this.children.push(projectile)
    return projectile
  }

  private _startPos: Position = { x: 0, y: 0 }

  fireForPlayer<T extends BaseProjectile>(
    Constructor: BaseProjectileConstructor<T>,
    charge: number,
    effect: ProjectileEffect,
    velocity?: number,
    pos?: Position,
    angle?: number,
    renderer: null | ProjectileRenderer = this.rendererPool.acquire(),
  ) {
    const player = this.scene.player
    if (isMatterTankFireMode(effect.mode) && !player.matterTank.hasChargeAvailable(charge, effect.mode)) {
      return
    }
    const startPos = pos ?? player.getProjectilePosition(0, this._startPos)
    const startAngle = angle ?? player.getProjectileAngle()

    const projectile = this.add(Constructor, player.matterTank, startPos.x, startPos.y, charge, effect, renderer)
    projectile.fire(startAngle, velocity)

    return projectile
  }

  update(dt: number) {
    for (let c of this.children) {
      c.update(dt)
    }
  }

  remove(projectile: BaseProjectile) {
    // already destroyed
    if (!this.children) return
    const i = this.children.indexOf(projectile)
    if (i !== -1) {
      this.children[i] = this.children[this.children.length - 1]
      this.children.pop()
    }
  }

  protected onDestroy() {
    this.rendererPool.destroy()
    // @ts-expect-error: destroy
    this.children = null
  }
}