import { FireMode, TILE_SIZE } from '../../config.ts'
import { shuffleArray } from '../../helpers/array.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterExchanger, ParticleTarget, Position } from '../../types.ts'
import type { MatterTank } from '../Matter/MatterTank.ts'
import { TerrainType } from '../TileMap/TileMap.ts'
import type { ProjectileManager } from './ProjectileManager.ts'
import { type IProjectileRenderer, ProjectileRenderer } from './ProjectileRenderer.ts'

const RADIUS_DECAY = 0.9
export const tilesToRadius = (tiles: number) => TILE_SIZE * Math.sqrt(tiles / Math.PI) * RADIUS_DECAY
export const radiusToTiles = (radius: number) => Math.floor(Math.PI * Math.pow(radius / (TILE_SIZE * RADIUS_DECAY), 2))

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

  protected DEFAULT_VELOCITY = 100

  constructor(
    public scene: GameLevel,
    public manager: ProjectileManager,
    public source: ProjectileSource,
    public matterTank: MatterTank,
    public x: number,
    public y: number,
    public mode: FireMode,
    protected renderer: IProjectileRenderer = new ProjectileRenderer(),
  ) {
    super(scene)

    this.renderer.attachToProjectile(this)
  }

  setTilesToModify(count: number) {
    count = Math.floor(count)
    const changed = this.tilesToModify !== count
    this.tilesToModify = count

    return changed
  }

  fire(angle: number, velocity?: number) {
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

  update(_dt: number) {
    if (!this.fired) return

    if (this.tilesModified === this.tilesToModify) {
      this.destroy()
      return
    }

    // restore lost charge
    if (!this.scene.worldBounds.contains(this.x, this.y)) {
      this.destroy()
      return
    }

    if (this.tilesModified > this.tilesToModify) {
      throw new Error('exceeded matter charge: ' + this.charge())
    }

    if (this.tilesToModify === -1) {
      throw new Error('tilesToModify not set before first update')
    }

    this.lifespanPercent = (this.tilesModified / this.tilesToModify)
  }

  private _emitPos = { x: 0, y: 0 }

  protected createTiles(count: number) {
    const tiles = this.scene.tilemap.applyEffect(
      this.x / TILE_SIZE,
      this.y / TILE_SIZE,
      this.radius,
      TerrainType.SOLID,
      count,
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
    for (let tile of shuffled) {
      const target = {
        x: tile.x * TILE_SIZE,
        y: tile.y * TILE_SIZE,
      }
      this.scene.particleManager.spawnMatter(source, target, true)
    }

    this.matterTank.applyPendingCharge(this.mode, changed)
    return tiles.length
  }

  protected destroyTiles(count: number) {
    const tileX = this.x / TILE_SIZE
    const tileY = this.y / TILE_SIZE
    const tiles = this.scene.tilemap.applyEffect(tileX, tileY, this.radius, TerrainType.EMPTY, count)
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
      for (let tile of shuffled) {
        const source = {
          x: tile.x * TILE_SIZE,
          y: tile.y * TILE_SIZE,
        }
        this.scene.particleManager.spawnMatter(source, target, false)
      }
      this.matterTank.applyPendingCharge(this.mode, tiles.length)
    }
    return changed
  }

  charge() {
    return this.tilesToModify - this.tilesModified
  }

  protected onDestroy() {
    this.matterTank.removePendingCharge(this.mode, this.charge())
    this.manager?.remove(this)
    this.renderer?.destroy()

    // @ts-expect-error: destroy
    this.renderer = null
    // @ts-expect-error: destroy
    this.manager = null
    // @ts-expect-error: destroy
    this.source = null
    // @ts-expect-error: destroy
    this.matterTank = null
  }
}
