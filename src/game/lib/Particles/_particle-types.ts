import type { Particle } from './Particle.ts'
import type { ParticleData } from '../MatterEngine/data/ParticleData.ts'
import type { ParticlePool } from '../MatterEngine/workers/ParticleSim/ParticlePool.ts'
import type { ParticleSim } from '../MatterEngine/workers/ParticleSim/ParticleSim.ts'

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
    ctx: ParticleSim,
  ) => void
  action: (
    p: Particle,
    renderer: ParticleData,
    pool: ParticlePool,
    ctx: ParticleSim,
  ) => void
}