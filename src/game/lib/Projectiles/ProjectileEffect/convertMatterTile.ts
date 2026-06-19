import { EMPTY, MatterType, setOwner } from '../../Matter/_Matter.types.ts'
import { OWNED_MATTER_TYPES } from '../../Matter/matter.ts'
import type { MatterTankId } from '../../Matter/MatterTank/_MatterTank.types.ts'
import { NO_MATTER_TANK_ID } from '../../Matter/MatterTank/_MatterTank.types.ts'
import { FireMode } from '../../Player/_FireMode-types.ts'

// this logic needs to be accessible by the workers without importing phaser
export function convertMatterTile(
  mode: FireMode,
  createType: MatterType,
  existing: MatterType,
  ownerId?: MatterTankId,
): MatterType | null {
  switch (mode) {
    case FireMode.DESTROY:
      if (existing === MatterType.PERMANENT || existing === EMPTY || existing === MatterType.WATER || existing === MatterType.FIRE) return null
      return EMPTY
    case FireMode.MELT:
      if (existing === MatterType.SOLID) return MatterType.SAND
      if (existing === MatterType.SAND) return MatterType.WATER
      return null
    case FireMode.SOLIDIFY:
      if (existing === MatterType.WATER) return MatterType.SAND
      if (existing === MatterType.SAND) return MatterType.SOLID
      return null
    case FireMode.CREATE:
      if (existing !== EMPTY) return null
      return OWNED_MATTER_TYPES.has(createType) ? setOwner(createType, ownerId ?? NO_MATTER_TANK_ID) : createType
  }
}
