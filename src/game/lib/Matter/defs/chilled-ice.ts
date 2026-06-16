import { random } from '../../../helpers/random'
import {
  FIRE,
  ICE,
  LAVA,
  type MatterDef,
  MatterType,
  SALT,
  SALT_WATER,
  STEAM,
  SupportType,
  WATER,
} from '../_Matter.types.ts'
import { MatterTypeSet } from '../data/MatterTypeSet'

const FAST_THAW_TARGETS = new MatterTypeSet(SALT, SALT_WATER, LAVA, FIRE, STEAM)

export const CHILLED_ICE_DEF = {
  id: MatterType.CHILLED_ICE,
  name: 'Chilled Ice',
  immutableSupport: SupportType.AFFIXED as const,
  acidImmune: true as const,
  action(sim, tx, ty, idx): void {
    // Thaw to regular ice
    if (random() < 6) {
      sim.tiles[idx] = ICE
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }

    // Fast thaw near heat or salt
    if (sim.borderingAny(tx, ty, idx, FAST_THAW_TARGETS) !== -1) {
      sim.tiles[idx] = ICE
      sim.markDirty(tx, ty)
      sim.next.add(idx)
      return
    }

    // Freeze adjacent water
    sim.doGrow(tx, ty, idx, WATER, 50)
  },
} satisfies MatterDef

export default CHILLED_ICE_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [MatterType.CHILLED_ICE]: typeof CHILLED_ICE_DEF;
  }
}