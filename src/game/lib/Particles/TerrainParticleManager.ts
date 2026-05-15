import { GameObjects, Math as PMath } from 'phaser'
import { TERRAIN_TYPE_TRANSITION_COLORS, TILE_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { TerrainType } from '../TileMap/TileMap.ts'
import { TerrainParticle } from './TerrainParticle.ts'

export class TerrainParticleManager extends SceneBound {
  public particles: TerrainParticle[] = []
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
    type: TerrainType = TerrainType.SOLID,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const force = PMath.FloatBetween(100, 200)
      const vx = Math.cos(angle) * force
      const vy = Math.sin(angle) * force * 0.7 // Less vertical spread
      const radius = PMath.Between(2, 6)

      this.particles.push(
        new TerrainParticle(centerX, centerY, vx, vy, type, radius),
      )
    }
  }

  update(dt: number) {
    this.particles = this.particles.filter((d) => this.updateParticle(d, dt))

    this.render()
  }

  updateParticle(d: TerrainParticle, dt: number) {
    d.lifetime += dt
    if (d.expired()) {
      return false
    }
    const gravity = 400
    d.vy += gravity * dt

    const result = this.scene.tilemap.checkForCollision(d.x, d.y, d.vx, d.vy, dt)

    if (result.collision) {
      const { stepX, stepY } = result
      this.scene.tilemap.applyEffect(stepX, stepY, d.radius, d.terrainType)
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

      const gridX = Math.round(particle.x / TILE_SIZE)
      const gridY = Math.round(particle.y / TILE_SIZE)
      const color = TERRAIN_TYPE_TRANSITION_COLORS[particle.terrainType]

      const lifespanPercent = particle.lifetimePercent()

      const alpha = PMath.Linear(1, 0, lifespanPercent)

      this.graphics.fillStyle(color, alpha)
      this.graphics.fillCircle(gridX, gridY, particle.radius)
    }
  }

  onDestroy() {
    this.graphics.destroy()
    // @ts-expect-error: destroy
    this.graphics = null
    // @ts-expect-error: destroy
    this.particles = null
  }
}