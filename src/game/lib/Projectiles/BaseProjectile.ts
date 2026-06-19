import { isMatterTankFireMode } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { MatterType } from '../Matter/_Matter.types.ts'
import type { MatterTank } from '../Matter/MatterTank/MatterTank.ts'
import { addTileFireModeEffect } from './ProjectileEffect/_ProjectileEffect-helpers.ts'
import type { ProjectileEffect, ProjectileEffectResult } from './ProjectileEffect/_ProjectileEffect.types.ts'
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
  protected initialVX: number
  protected initialVY: number
  protected lifespanPercent = 0

  protected readonly DEFAULT_VELOCITY: number = 300

  // True while an APPLY_EFFECT request is in-flight to the coordinator worker.
  // Prevents double-sends on consecutive frames before the result arrives.
  private _waitingForResult = false

  // Still used by TunnelDestroyProjectile which clears it each frame.
  protected visitedTiles = new Set<number>()

  constructor(
    public scene: GameLevel,
    public manager: ProjectileManager,
    public matterTank: MatterTank,
    public x: number,
    public y: number,
    public effect: ProjectileEffect,
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
    this.initialVX = this.vx = vx * velocity
    this.initialVY = this.vy = vy * velocity
    this.fired = true

    if (isMatterTankFireMode(this.effect.mode)) {
      this.matterTank.addPendingCharge(this.effect.mode, this.tilesToModify)
    }
  }

  abstract update(dt: number): void

  // Called when an in-flight applyTiles result comes back with tilesModified > 0.
  // Subclasses may override to react (e.g. InstantProjectile destroys itself here).
  protected onApplyTilesResult(_tiles: ProjectileEffectResult[]): void {
  }

  protected applyTiles(count: number, innerRadius = 0, onResult?: (tiles: ProjectileEffectResult[]) => void): void {
    if (this._waitingForResult || count <= 0) return
    this._waitingForResult = true

    const effect = this.effect
    const matterTank = this.matterTank
    // Capture emit position at call-time; the projectile may move before the callback fires.
    const { x: emitX, y: emitY } = matterTank.getEmitPos()
    const emitPos = { x: emitX, y: emitY }
    const collectTarget = matterTank.source

    const bounds = this.scene.player.getPreventCreateBounds()

    this.scene.matterBridge.sendApplyEffect(
      {
        mode: effect.mode,
        createType: effect.createType ?? MatterType.SOLID,
        tileX: Math.round(this.x),
        tileY: Math.round(this.y),
        tileRadius: this.radius,
        innerRadius,
        ownerId: matterTank.id,
        tilesToModify: count,
        playerBoundsLeft: bounds.playerBoundsLeft,
        playerBoundsRight: bounds.playerBoundsRight,
        playerBoundsTop: bounds.playerBoundsTop,
        playerBoundsBottom: bounds.playerBoundsBottom,
      },
      (result) => {
        this._waitingForResult = false
        if (this.destroyed) return

        this.tilesModified += result.tilesModified
        if (isMatterTankFireMode(effect.mode)) {
          matterTank.applyPendingCharge(effect.mode, result.tilesModified)
        }

        if (result.tilesModified > 0) {
          addTileFireModeEffect(this.scene.tilemap, result.tiles, effect.mode)
          effect.onApplied(this.scene.tilemap, emitPos, collectTarget, result.tiles)
          onResult?.(result.tiles)
          this.onApplyTilesResult(result.tiles)
        }
      },
    )
  }

  charge() {
    return this.tilesToModify - this.tilesModified
  }

  protected onDestroy() {
    if (isMatterTankFireMode(this.effect.mode)) {
      this.matterTank.removePendingCharge(this.effect.mode, this.charge())
    }
    this.manager?.remove(this)
    this.renderer?.destroy()

    this.renderer = null
    // @ts-expect-error: destroy
    this.manager = null
    // @ts-expect-error: destroy
    this.source = null
    // @ts-expect-error: destroy
    this.matterTank = null
  }
}
