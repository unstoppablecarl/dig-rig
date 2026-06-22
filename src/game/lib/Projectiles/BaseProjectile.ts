import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterTank } from '../Matter/Tank/MatterTank.ts'
import type { ProjectileEffect } from './ProjectileEffect/_ProjectileEffect.types.ts'
import type { ProjectileManager } from './ProjectileManager.ts'
import { ProjectileRenderer } from './ProjectileRenderer.ts'

type BaseProjectileArgs = ConstructorParameters<typeof BaseProjectile>;

export type BaseProjectileConstructor<T extends BaseProjectile> = new (...args: BaseProjectileArgs) => T;

export abstract class BaseProjectile extends SceneBound {
  public tilesToModify: number = -1
  public radius = 0

  protected vx: number = 0
  protected vy: number = 0
  protected tilesModified = 0
  protected fired = false
  protected lifespanPercent = 0
  /** Shadow of bridge.tilesModified[slotIdx] — used to compute per-frame delta. */
  protected _lastSlotModified = 0

  protected readonly DEFAULT_VELOCITY: number = 300

  constructor(
    public scene: GameLevel,
    public manager: ProjectileManager,
    public matterTank: MatterTank,
    public x: number,
    public y: number,
    public effect: ProjectileEffect,
    public slotIdx: number,
    protected renderer: ProjectileRenderer | null = null,
  ) {
    super(scene)
    this.renderer?.attachToProjectile(this)
  }

  setTilesToModify(count: number) {
    count = Math.floor(count)
    const changed = this.tilesToModify !== count
    this.tilesToModify = count
    return changed
  }

  fire(angle = 0, velocity?: number) {
    const vx = Math.cos(angle)
    const vy = Math.sin(angle)
    this.fireRaw(vx, vy, velocity)
  }

  fireRaw(vx: number, vy: number, velocity = this.DEFAULT_VELOCITY) {
    this.vx = vx * velocity
    this.vy = vy * velocity
    this.fired = true
  }

  abstract update(dt: number): void

  // Subclasses override to react when the coordinator has modified tiles for this slot.
  // Called each frame when _readSlotDelta() returns > 0.
  protected onTilesModified(): void {
  }

  // Write current projectile state to the SAB slot so the coordinator picks it up next step.
  protected sync(count: number, innerRadius = 0): void {
    if (count <= 0) return
    this.scene.io.projectileManager.syncFromProjectile(this, innerRadius)
  }

  // Read how many tiles the coordinator processed for this slot since last frame.
  // Updates tilesModified Returns the delta (0 if no slot).
  protected syncTilesModified(): number {
    if (this.slotIdx < 0) return 0
    const bridge = this.scene.io.projectileManager
    const current = bridge.tilesModified[this.slotIdx]
    const delta = current - this._lastSlotModified
    if (delta > 0) {
      this._lastSlotModified = current
      this.tilesModified += delta
      this.onTilesModified()
    }
    return delta
  }

  charge() {
    return this.tilesToModify - this.tilesModified
  }

  protected onDestroy() {
    this.manager?.remove(this)
    this.renderer?.destroy()

    this.renderer = null
    // @ts-expect-error: destroy
    this.manager = null
    // @ts-expect-error: destroy
    this.matterTank = null
  }
}
