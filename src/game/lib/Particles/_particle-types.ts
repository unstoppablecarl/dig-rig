import type { Particle } from './Particle.ts'
import type { ParticleContext } from './ParticleContext.ts'
import type { ParticlePool } from './ParticlePool.ts'
import type { ParticleRenderer } from './ParticleRenderer.ts'

export enum ParticleType {
  NONE,
  GUNPOWDER_EXPLOSION,
  NITRO_EXPLOSION,
  NAPALM_EXPLOSION,
  C4_EXPLOSION,
  METHANE_EXPLOSION,
  CHARGED_NITRO,
  LAVA_BURST,
}

export type ParticleDef = {
  particlesToSpawn: number,
  init: (
    p: Particle,
    spawnX: number,
    spawnY: number,
    ctx: ParticleContext,
  ) => void
  action: (
    p: Particle,
    renderer: ParticleRenderer,
    pool: ParticlePool,
    ctx: ParticleContext,
  ) => void
}