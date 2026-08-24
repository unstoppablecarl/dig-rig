import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { FIRE, getFirstOwnerId, type MatterDef, NITRO } from '../_Matter.types.ts'

export const NITRO_DEF = {
  id: NITRO,
  name: 'Nitro',
  hasOwnerId: true as const,
  settles: true as const,
  lavaBurnable: true as const,
  acidMeltable: true as const,
  action(sim, tx, ty, idx): void {
    if (random() < 30) {
      const nidx = sim.bordering(tx, ty, idx, FIRE)
      if (nidx !== -1) {
        const tiles = sim.tiles

        // nitro owner or fallback to fire owner
        const ownerId = getFirstOwnerId(tiles[idx], tiles[nidx])
        sim.doBorderBurn(tx, ty, idx, ownerId)

        sim.spawnParticle(ParticleType.NITRO_EXPLOSION, tx, ty, ownerId)
        return
      }
    }

    sim.doPowderFall(tx, ty, idx)
  },
} satisfies MatterDef

export default NITRO_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [NITRO]: typeof NITRO_DEF;
  }
}
