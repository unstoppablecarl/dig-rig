import type { Particle } from './Particle.ts'
import type { ParticlePixelRenderer } from './ParticlePixelRenderer.ts'
import type { ParticlePool } from './ParticlePool.ts'
import type { ParticleSim } from './ParticleSim.ts'

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
    ctx: ParticleSim,
  ) => void
  action: (
    p: Particle,
    renderer: ParticlePixelRenderer,
    pool: ParticlePool,
    ctx: ParticleSim,
  ) => void
}