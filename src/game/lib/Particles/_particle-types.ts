import type { ParticleSim } from '../MatterEngine/workers/ParticleSim/ParticleSim.ts'
import type { Particle } from './Particle.ts'

export enum ParticleType {
  NONE,
  GUNPOWDER_EXPLOSION,
  NITRO_EXPLOSION,
  NAPALM_EXPLOSION,
  C4_EXPLOSION,
  METHANE_EXPLOSION,
  THERMITE_SPARK,
  LAVA_BURST,
  FLAMETHROWER_BURST,
}

export type ParticleDef = {
  particlesToSpawn: number,
  init: (p: Particle, sim: ParticleSim, ...args: any[]) => void
  action: (p: Particle, sim: ParticleSim) => void
}