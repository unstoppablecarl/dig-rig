import { FireMode } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import type { MatterTank } from '../Matter/MatterTank.ts'
import type { BaseProjectile, BaseProjectileConstructor } from './BaseProjectile.ts'
import { type ProjectileSource } from './Projectile.ts'
import { type IProjectileRenderer } from './ProjectileRenderer.ts'

export class ProjectileManager extends SceneBound {
  public children: BaseProjectile[] = []

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
  }

  add<T extends BaseProjectile>(
    Constructor: BaseProjectileConstructor<T>,
    source: ProjectileSource,
    matterTank: MatterTank,
    x: number,
    y: number,
    charge: number,
    mode: FireMode,
    renderer?: IProjectileRenderer,
  ): T {
    const projectile = new Constructor(this.scene, this, source, matterTank, x, y, mode, renderer)

    projectile.setTilesToModify(charge)
    this.children.push(projectile)
    return projectile
  }

  private _startPos: Position = { x: 0, y: 0 }

  fireForPlayer<T extends BaseProjectile>(
    Constructor: BaseProjectileConstructor<T>,
    charge: number,
    mode: FireMode,
    velocity?: number,
    pos?: Position,
    angle?: number,
    renderer?: IProjectileRenderer,
  ) {
    const player = this.scene.player
    if (!player.matterTank.hasChargeAvailable(charge, mode)) {
      console.log('Not enough charge!')
      return
    }
    const startPos = pos ?? player.getProjectilePosition(0, this._startPos)
    const startAngle = angle ?? player.getProjectileAngle()

    const projectile = this.add(Constructor, player, player.matterTank, startPos.x, startPos.y, charge, mode, renderer)
    projectile.fire(startAngle, velocity)

    return projectile
  }

  update(dt: number) {
    for (let c of this.children) {
      c.update(dt)
    }
  }

  remove(projectile: BaseProjectile) {
    // after destroyed
    if (!this.children) return
    this.children = this.children.filter(p => p !== projectile)
  }

  destroy() {
    super.destroy()

    // @ts-expect-error: destroy
    this.children = null
  }
}