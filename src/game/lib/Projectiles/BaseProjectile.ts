import { shuffleArray } from '../../helpers/array.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterExchanger, ParticleTarget, Position } from '../../types.ts'
import type { MatterTank } from '../Matter/MatterTank.ts'
import { FireMode } from '../Player/_FireMode-types'
import type { Tile, TileEffectResult } from '../Tilemap/Tilemap.ts'
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
    public mode: FireMode,
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

    this.matterTank.addPendingCharge(this.mode, this.tilesToModify)
  }

  abstract update(dt: number): void

  private _emitPos = { x: 0, y: 0 }
  private _effectTiles: TileEffectResult[] = []

  protected createTiles(count: number, innerRadius = 0) {
    const tiles = this.scene.tilemap.applyEffect(
      this._effectTiles,
      this.x,
      this.y,
      this.radius,
      FireMode.CREATE,
      count,
      innerRadius,
    )

    const changed = tiles.length
    this.tilesModified += changed

    let source: Position
    if ('matterParticleEmitPosition' in this.source) {
      source = this.source.matterParticleEmitPosition(this._emitPos)
    } else {
      source = this.source
    }

    const shuffled = shuffleArray(tiles)
    for (const tile of shuffled) {
      const target = {
        x: tile.x,
        y: tile.y,
      }
      this.scene.vfxParticleManager.spawnMatter(source, target, true)
    }
    this.matterTank.applyPendingCharge(FireMode.CREATE, changed)

    return tiles.length
  }

  protected createTilesFromList(tiles: Tile[]): number {
    const created = this.scene.tilemap.applyCreateTiles(tiles)
    const changed = created.length
    if (!changed) return 0
    this.tilesModified += changed
    let source: Position
    if ('matterParticleEmitPosition' in this.source) {
      source = this.source.matterParticleEmitPosition(this._emitPos)
    } else {
      source = this.source
    }
    shuffleArray(created)
    for (const tile of created) {
      this.scene.vfxParticleManager.spawnMatter(source, tile, true)
    }
    this.matterTank.applyPendingCharge(FireMode.CREATE, changed)
    return changed
  }

  protected destroyTiles(count: number): Tile[] {
    const tileX = this.x
    const tileY = this.y
    const tiles = this.scene.tilemap.applyEffect(this._effectTiles, tileX, tileY, this.radius, FireMode.DESTROY, count)
    const changed = tiles.length
    this.tilesModified += changed
    if (changed) {
      let target: Position
      if ('matterParticleCollectPosition' in this.source) {
        target = this.source.matterParticleCollectPosition()
      } else {
        target = this.source
      }

      const shuffled = shuffleArray(tiles)
      for (const tile of shuffled) {
        const source = {
          x: tile.x,
          y: tile.y,
        }
        this.scene.vfxParticleManager.spawnMatter(source, target, false)
      }

      this.matterTank.applyPendingCharge(FireMode.DESTROY, tiles.length)
    }

    return tiles
  }

  charge() {
    return this.tilesToModify - this.tilesModified
  }

  protected onDestroy() {
    this.matterTank.removePendingCharge(this.mode, this.charge())
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
