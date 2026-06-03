import { type ParticleDef, ParticleType } from './_particle-types.ts'
import { C4_EXPLOSION } from './particles/c4-explosion.ts'
import { CHARGED_NITRO } from './particles/charged-nitro.ts'
import { GUNPOWDER_EXPLOSION } from './particles/gunpowder-explosion.ts'
import { LAVA_BURST } from './particles/lava-burst.ts'
import { METHANE_EXPLOSION } from './particles/methane-explosion.ts'
import { NAPALM_EXPLOSION } from './particles/napalm-explosion.ts'
import { NITRO_EXPLOSION } from './particles/nitro-explosion.ts'

export const PARTICLE_DEFS: Record<ParticleType, ParticleDef> = {
  [ParticleType.NONE]: {
    particlesToSpawn: 0,
    init() {
    },
    action() {
    },
  },
  [ParticleType.GUNPOWDER_EXPLOSION]: GUNPOWDER_EXPLOSION,
  [ParticleType.NITRO_EXPLOSION]: NITRO_EXPLOSION,
  [ParticleType.NAPALM_EXPLOSION]: NAPALM_EXPLOSION,
  [ParticleType.C4_EXPLOSION]: C4_EXPLOSION,
  [ParticleType.METHANE_EXPLOSION]: METHANE_EXPLOSION,
  [ParticleType.CHARGED_NITRO]: CHARGED_NITRO,
  [ParticleType.LAVA_BURST]: LAVA_BURST,
}
