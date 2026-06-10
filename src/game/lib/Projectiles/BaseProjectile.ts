import { isMatterTankFireMode } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterExchanger, ParticleTarget, Position } from '../../types.ts'
import type { MatterTank } from '../Matter/MatterTank/MatterTank.ts'
import { applyEffect } from '../Tilemap/TileMutation.ts'
import type { ProjectileEffect, ProjectileEffectResult } from './ProjectileEffect/_ProjectileEffect.types.ts'
import type { ProjectileManager } from './ProjectileManager.ts'
import { ProjectileRenderer } from './ProjectileRenderer.ts'

export type ProjectileSource = (MatterExchanger | Position) & ParticleTarget

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

  protected readonly DEFAULT_VELOCITY: number = 100

  constructor(
    public scene: GameLevel,
    public manager: ProjectileManager,
    public source: ProjectileSource,
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

  private _emitPos = { x: 0, y: 0 }
  private _effectTiles: ProjectileEffectResult[] = []

  protected applyTiles(count: number, innerRadius = 0): ProjectileEffectResult[] {
    const tiles = applyEffect(
      this.scene.tilemap, this._effectTiles, this.x, this.y, this.radius, this.effect, count, innerRadius,
    )
    const changed = tiles.length
    if (!changed) return tiles
    this.tilesModified += changed
    this.effect.onApplied(
      this.scene.tilemap,
      this._resolveEmitPos(),
      this._resolveCollectPos(),
      tiles,
    )
    if (isMatterTankFireMode(this.effect.mode)) {
      this.matterTank.applyPendingCharge(this.effect.mode, changed)
    }
    return tiles
  }

  private _resolveEmitPos(): Position {
    if ('matterParticleEmitPosition' in this.source) {
      return this.source.matterParticleEmitPosition(this._emitPos)
    }
    return this.source
  }

  private _resolveCollectPos(): Position {
    if ('matterParticleCollectPosition' in this.source) {
      return this.source.matterParticleCollectPosition()
    }
    return this.source
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
