import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { ParticleTypeName } from '../Matter/_MatterWorker-types.ts'
import { ParticlePool } from './ParticlePool.ts'
import { ParticleRenderer } from './ParticleRenderer.ts'
import { PARTICLE_DEFS } from './particleActions.ts'

const PARTICLES_PER_SPAWN: Partial<Record<ParticleTypeName, number>> = {
  gunpowder_explosion: 12,
  nitro_explosion:     20,
  napalm_explosion:    6,
  c4_explosion:        8,
  methane_explosion:   3,
  charged_nitro:       1,
  lava_burst:          5,
}

export class ParticleLayer {
  private renderer: ParticleRenderer
  private pool: ParticlePool

  constructor(scene: GameLevel) {
    const graphics = scene.add.graphics()
    scene.layers.terrainParticles.add(graphics)
    this.renderer = new ParticleRenderer(graphics)
    this.pool = new ParticlePool()
  }

  spawn(type: ParticleTypeName, tileX: number, tileY: number) {
    const def = PARTICLE_DEFS[type]
    if (!def) return
    const count = PARTICLES_PER_SPAWN[type] ?? 1

    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire(type, tileX, tileY)
      if (!p) break
      def.init(p, tileX, tileY)
    }
  }

  update() {
    this.renderer.clear()

    this.pool.forEachActive((p) => {
      const def = PARTICLE_DEFS[p.particleType as ParticleTypeName]
      if (!def) { this.pool.release(p); return }
      def.action(p, this.renderer, this.pool)
      p.actionIterations++
    })
  }
}
