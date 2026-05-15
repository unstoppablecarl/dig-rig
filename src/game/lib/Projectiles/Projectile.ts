import { Math as PMath, Time } from 'phaser'
import { FireMode, TILE_SIZE } from '../../config.ts'
import { getCollisionSteps } from '../../helpers/_helpers.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterTank } from '../Matter/MatterTank.ts'
import { TerrainType } from '../TileMap/TileMap.ts'
import { BaseProjectile, type ProjectileSource, tilesToRadius } from './BaseProjectile.ts'
import type { ProjectileManager } from './ProjectileManager.ts'
import { type IProjectileRenderer } from './ProjectileRenderer.ts'
import TimerEvent = Time.TimerEvent

const EXPAND_RATE_MS = 100
const EXPAND_AMOUNT = TILE_SIZE
const EXPAND_START_RADIUS = 2
const FINAL_DECAY_SCALE = 0.9

export class Projectile extends BaseProjectile {
  public expandRateMs = EXPAND_RATE_MS

  private expandTimer: TimerEvent | null = null
  private initialRadius: number

  constructor(
    scene: GameLevel,
    manager: ProjectileManager,
    source: ProjectileSource,
    matterTank: MatterTank,
    x: number,
    y: number,
    mode: FireMode,
    renderer?: IProjectileRenderer,
  ) {
    super(
      scene,
      manager,
      source,
      matterTank,
      x,
      y,
      mode,
      renderer,
    )
  }

  setTilesToModify(count: number) {
    const changed = super.setTilesToModify(count)
    if (changed) {
      this.initialRadius = this.radius = tilesToRadius(count)
      this.renderer.queueReRender()
    }

    return changed
  }

  update(dt: number) {
    this.renderer.update(this)

    if (!this.fired) return

    // if in create mode, and not already collided/expanding yet, and collided with collision map tile
    if (this.mode === FireMode.CREATE && !this.expandTimer) {
      const { stepDx, stepDy, totalSteps } = getCollisionSteps(this.vx, this.vy, dt)

      for (let i = 0; i < totalSteps; i++) {
        const stepX = this.x + stepDx * i
        const stepY = this.y + stepDy * i

        const collision = this.scene.tilemap.getTileFromWorld(
          stepX,
          stepY,
        ) !== TerrainType.EMPTY

        if (collision) {
          this.renderer.fadeOutAndDestroy()
          this.radius = EXPAND_START_RADIUS
          // stop
          this.vx = 0
          this.vy = 0

          this.expandTimer = this.startExpandTimer()

          break
        }
      }
    }

    if (this.mode === FireMode.DESTROY) {
      if (this.charge() > 0) {
        this.destroyTiles(this.charge())

        const easedValue = PMath.Easing.Circular.In(this.lifespanPercent)
        const decay = PMath.Linear(1, FINAL_DECAY_SCALE, easedValue)
        this.radius = this.initialRadius * decay
        this.renderer.queueReRender()
      }
    }

    this.x += this.vx * dt
    this.y += this.vy * dt

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

  public startExpandTimer() {
    return this.scene.time.addEvent({
      delay: this.expandRateMs,
      callbackScope: this,
      loop: true,
      callback: () => {
        if (this.destroyed) return
        this.radius += EXPAND_AMOUNT

        const charge = this.charge()
        if (charge > 0) {
          this.createTiles(charge)
          this.renderer.queueReRender()
        }
      },
    })
  }

  onDestroy() {
    super.onDestroy()
    this.expandTimer?.destroy()
    this.expandTimer = null
  }
}