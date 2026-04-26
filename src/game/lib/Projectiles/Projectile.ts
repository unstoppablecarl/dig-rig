import { Time, Math as PMath } from 'phaser'
import { FireMode, TILE_SIZE } from '../../config.ts'
import { getCollisionSteps } from '../../helpers/_helpers.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterExchanger, ParticleTarget, Position } from '../../types.ts'
import type { MatterTank } from '../Matter/MatterTank.ts'
import { TerrainType } from '../TileMap/TileMap.ts'
import { BaseProjectile } from './BaseProjectile.ts'
import type { ProjectileManager } from './ProjectileManager.ts'
import TimerEvent = Time.TimerEvent

const VELOCITY = 100
const MIN_VELOCITY = 0.1 * VELOCITY
const EXPAND_RATE_MS = 100
const EXPAND_AMOUNT = TILE_SIZE
const EXPAND_START_RADIUS = 2

const tilesToRadius = (tiles: number) => TILE_SIZE * Math.sqrt(tiles / Math.PI) * .9

export type ProjectileSource = (MatterExchanger | Position) & ParticleTarget

export class Projectile extends BaseProjectile {

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
  ) {
    super(
      scene,
      manager,
      source,
      matterTank,
      x,
      y,
      mode,
    )

    scene.events.once('destroy', this.destroy, this)
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
    if (this.mode == FireMode.CREATE && !this.expandTimer) {
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

          this.expandTimer = this.scene.time.addEvent({
            delay: EXPAND_RATE_MS,
            callbackScope: this,
            loop: true,
            callback: () => {
              this.radius += EXPAND_AMOUNT

              if (this.charge() > 0) {
                this.createTiles(this.charge())
                this.renderer.queueReRender()
              }
            },
          })

          break
        }
      }
    }

    if (this.mode == FireMode.DESTROY) {
      if (this.charge() > 0) {
        this.destroyTiles(this.charge())

        const DECAY_RADIUS = true
        if (DECAY_RADIUS) {
          const easedValue = PMath.Easing.Circular.In(this.lifespanPercent)
          const FINAL_DECAY_SCALE = 0.9
          const decay = PMath.Linear(1, FINAL_DECAY_SCALE, easedValue)
          this.radius = this.initialRadius * decay
          this.renderer.queueReRender()
        }

        const DECAY_VELOCITY = false
        if (DECAY_VELOCITY) {
          const decay = 1 - PMath.Easing.Circular.In(this.lifespanPercent)
          this.vx = this.initialVX * decay
          this.vy = this.initialVY * decay

          const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2)

          if (speed < MIN_VELOCITY) {
            const directionX = this.vx / speed
            const directionY = this.vy / speed

            this.vx = directionX * MIN_VELOCITY
            this.vy = directionY * MIN_VELOCITY
          }
        }
      }
    }

    this.x += this.vx * dt
    this.y += this.vy * dt

    super.update(dt)
  }

  destroy() {
    this.expandTimer?.destroy()
    this.expandTimer = null

    super.destroy()
  }
}