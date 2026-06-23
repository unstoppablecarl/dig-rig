import { MAX_PROJECTILES } from '../../config.ts'
import { isMatterTankFireMode } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import type { MatterTank } from '../Matter/Tank/MatterTank.ts'
import { ProjectileStatus } from '../MatterEngine/data/ProjectileManagerData.ts'
import type { BaseProjectile, BaseProjectileConstructor } from './BaseProjectile.ts'
import type { ProjectileEffect } from './ProjectileEffect/_ProjectileEffect.types.ts'
import type { ProjectileRenderer } from './ProjectileRenderer.ts'
import { ProjectileRendererPool } from './ProjectileRendererPool.ts'

export class ProjectileManager extends SceneBound {
  public children: BaseProjectile[] = []
  private rendererPool: ProjectileRendererPool
  private readonly _bySlot: (BaseProjectile | null)[] = new Array(MAX_PROJECTILES).fill(null)

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.rendererPool = new ProjectileRendererPool(scene)
  }

  bySlot(slotIdx: number): BaseProjectile | null {
    return this._bySlot[slotIdx] ?? null
  }

  add<T extends BaseProjectile>(
    Constructor: BaseProjectileConstructor<T>,
    matterTank: MatterTank,
    x: number,
    y: number,
    charge: number,
    effect: ProjectileEffect,
    renderer: null | ProjectileRenderer = this.rendererPool.acquire(),
  ): T | undefined {
    const data = this.scene.io.projectileManager
    const slotIdx = data.acquire()
    if (slotIdx < 0) {
      console.warn('projectiles full')
      return undefined
    }
    const projectile = new Constructor(this.scene, this, matterTank, x, y, effect, slotIdx, renderer)
    data.status[slotIdx] = ProjectileStatus.INACTIVE
    data.tilesModified[slotIdx] = 0
    this._bySlot[slotIdx] = projectile

    projectile.setTilesToModify(charge)
    data.registerPending(projectile)
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
    projectile?.fire(startAngle, velocity)

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
    if (projectile.slotIdx >= 0) {
      const data = this.scene.io.projectileManager
      data.release(projectile.slotIdx)
    }
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