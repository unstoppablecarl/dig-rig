import { GameObjects, Math as PMath } from 'phaser'
import { FIRE_MODE_COLORS } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { MatterType } from '../Matter/_Matter.types.ts'
import { NO_MATTER_TANK_ID } from '../Matter/MatterTank/_MatterTank.types.ts'
import { FireMode } from '../Player/_FireMode-types'
import { fireModeToEffect } from '../Projectiles/ProjectileEffect/ProjectileEffect.ts'
import { VFXTerrainParticle } from '../VFXParticles/VFXTerrainParticle.ts'

export class TerrainBlobParticleManager extends SceneBound {
  public particles: VFXTerrainParticle[] = []
  private graphics: GameObjects.Graphics

  constructor(public scene: GameLevel) {
    super(scene)
    this.graphics = scene.add.graphics()
    this.scene.layers.terrainParticles.add(this.graphics)
  }

  explode(
    centerX: number,
    centerY: number,
    count: number = 20,
    type: FireMode.CREATE | FireMode.DESTROY = FireMode.CREATE,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const force = PMath.FloatBetween(100, 200)
      const vx = Math.cos(angle) * force
      const vy = Math.sin(angle) * force * 0.7 // Less vertical spread
      const radius = PMath.Between(2, 6)

      this.particles.push(
        new VFXTerrainParticle(centerX, centerY, vx, vy, type, radius),
      )
    }
  }

  update(dt: number) {
    let alive = 0
    for (let i = 0; i < this.particles.length; i++) {
      if (this.updateParticle(this.particles[i], dt)) this.particles[alive++] = this.particles[i]
    }
    this.particles.length = alive

    this.render()
  }

  updateParticle(d: VFXTerrainParticle, dt: number) {
    d.lifetime += dt
    if (d.expired()) {
      return false
    }
    const gravity = 400
    d.vy += gravity * dt

    const result = this.scene.tilemap.checkForCollision(d.x, d.y, d.vx, d.vy, dt)

    if (result.collision) {
      const { stepX, stepY } = result
      const effect = fireModeToEffect(d.mode)
      const bounds = this.scene.player.getPreventCreateBounds()
      this.scene.matterBridge.sendApplyEffect({
        mode: effect.mode,
        createType: effect.createType ?? MatterType.SOLID,
        tileX: Math.round(stepX),
        tileY: Math.round(stepY),
        tileRadius: d.radius,
        innerRadius: 0,
        ownerId: NO_MATTER_TANK_ID,
        tilesToModify: Number.MAX_SAFE_INTEGER,
        playerBoundsLeft: bounds.playerBoundsLeft,
        playerBoundsRight: bounds.playerBoundsRight,
        playerBoundsTop: bounds.playerBoundsTop,
        playerBoundsBottom: bounds.playerBoundsBottom,
      })
      return false
    } else {
      const { dx, dy } = result
      d.x += dx
      d.y += dy
    }

    return true
  }

  private render() {
    this.graphics.clear()
    const len = this.particles.length

    for (let i = 0; i < len; i++) {
      const particle = this.particles[i]

      const gridX = Math.round(particle.x)
      const gridY = Math.round(particle.y)
      const color = FIRE_MODE_COLORS[particle.mode].color

      const lifespanPercent = particle.lifetimePercent()

      const alpha = PMath.Linear(1, 0, lifespanPercent)

      this.graphics.fillStyle(color, alpha)
      this.graphics.fillCircle(gridX, gridY, particle.radius)
    }
  }

  protected onDestroy() {
    this.graphics.destroy()
    // @ts-expect-error: destroy
    this.graphics = null
    // @ts-expect-error: destroy
    this.particles = null
  }
}