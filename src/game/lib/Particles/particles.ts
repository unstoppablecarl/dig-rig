import { type ParticleDef, ParticleType } from './_particle-types.ts'
import { C4_EXPLOSION } from './particles/c4-explosion.ts'
import { FLAMETHROWER_BURST } from './particles/flamethrower-burst.ts'
import { GUNPOWDER_EXPLOSION } from './particles/gunpowder-explosion.ts'
import { LAVA_BURST } from './particles/lava-burst.ts'
import { LIQUID_SPLASH } from './particles/liquid-splash.ts'
import { METHANE_EXPLOSION } from './particles/methane-explosion.ts'
import { NAPALM_EXPLOSION } from './particles/napalm-explosion.ts'
import { NITRO_EXPLOSION } from './particles/nitro-explosion.ts'
import { THERMITE_SPARK } from './particles/thermite-spark.ts'

export const PARTICLE_DEFS = {
  [ParticleType.NONE]: {
    spawn() {
    },
    action() {
    },
  },
  [ParticleType.GUNPOWDER_EXPLOSION]: GUNPOWDER_EXPLOSION,
  [ParticleType.NITRO_EXPLOSION]: NITRO_EXPLOSION,
  [ParticleType.NAPALM_EXPLOSION]: NAPALM_EXPLOSION,
  [ParticleType.C4_EXPLOSION]: C4_EXPLOSION,
  [ParticleType.METHANE_EXPLOSION]: METHANE_EXPLOSION,
  [ParticleType.THERMITE_SPARK]: THERMITE_SPARK,
  [ParticleType.LAVA_BURST]: LAVA_BURST,
  [ParticleType.FLAMETHROWER_BURST]: FLAMETHROWER_BURST,
  [ParticleType.LIQUID_SPLASH]: LIQUID_SPLASH,
} satisfies Record<ParticleType, ParticleDef>
