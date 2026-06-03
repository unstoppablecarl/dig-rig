import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { ParticleType } from './_particle-types.ts'
import { makeParticleContext, type ParticleContext } from './ParticleContext.ts'
import { ParticlePool } from './ParticlePool.ts'
import { ParticleRenderer } from './ParticleRenderer.ts'
import { PARTICLE_DEFS } from './particles.ts'

export class ParticleManager extends SceneBound {
  readonly pool: ParticlePool
  public pendingActivations: number[] = []
  readonly renderer: ParticleRenderer
  private context: ParticleContext

  constructor(scene: GameLevel) {
    super(scene)
    const graphics = scene.add.graphics()
    scene.layers.terrainParticles.add(graphics)
    this.renderer = new ParticleRenderer(graphics)
    this.pool = new ParticlePool()
    this.context = makeParticleContext(scene.tilemap, this.pendingActivations)
  }

  flushTileActivations(): number[] {
    const result = this.pendingActivations.slice()
    this.pendingActivations.length = 0
    return result
  }

  spawn(type: ParticleType, tileX: number, tileY: number) {
    const def = PARTICLE_DEFS[type]
    if (!def) return
    const count = def.particlesToSpawn
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire(type, tileX, tileY)
      if (!p) break
      def.init(p, tileX, tileY, this.context)
    }
  }

  update() {
    this.renderer.clear()

    this.pool.forEachActive((p) => {
      const def = PARTICLE_DEFS[p.particleType]
      if (!def) {
        this.pool.release(p)
        return
      }
      def.action(p, this.renderer, this.pool, this.context)
      p.actionIterations++
    })
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.pool = null
    // @ts-expect-error: destroy
    this.pendingActivations = null
    // @ts-expect-error: destroy
    this.renderer = null
  }
}
