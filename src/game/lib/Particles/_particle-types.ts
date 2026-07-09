import type { MatterValue } from '../Matter/_Matter.types.ts'
import type { MatterTankId } from '../Matter/Tank/_MatterTank.types.ts'
import type { ParticlePool } from '../MatterEngine/workers/ParticleSim/ParticlePool.ts'
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
  LIQUID_SPLASH,
}

export type ParticleDef = {
  spawn: (pool: ParticlePool, sim: ParticleSim, particleType: ParticleType, x: number, y: number, ownerId?: MatterTankId, vx?: number, vy?: number, value?: MatterValue) => void
  action: (p: Particle, sim: ParticleSim) => void
}