import type { WeaponDef } from './_weapon.types.ts'

import { BasicWeapon } from './Weapons/BasicWeapon.ts'
import { InstantWeapon } from './Weapons/InstantWeapon.ts'
import { RapidWeapon } from './Weapons/RapidWeapon.ts'
import { TorchWeapon } from './Weapons/TorchWeapon.ts'
import { TunnelWeapon } from './Weapons/TunnelWeapon.ts'

export enum PlayerWeapon {
  BASIC = 'BASIC',
  RAPID = 'RAPID',
  INSTANT = 'INSTANT',
  TORCH = 'TORCH',
  TUNNEL = 'TUNNEL',
}

export const WEAPONS = {
  [PlayerWeapon.BASIC]: {
    id: PlayerWeapon.BASIC,
    displayName: 'Basic',
    constructor: BasicWeapon,
    slot: 1,
  },
  [PlayerWeapon.RAPID]: {
    id: PlayerWeapon.RAPID,
    displayName: 'Rapid',
    constructor: RapidWeapon,
    slot: 2,
  },
  [PlayerWeapon.INSTANT]: {
    id: PlayerWeapon.INSTANT,
    displayName: 'Instant',
    constructor: InstantWeapon,
    slot: 3,
  },
  [PlayerWeapon.TORCH]: {
    id: PlayerWeapon.TORCH,
    displayName: 'Torch',
    constructor: TorchWeapon,
    slot: 4,
  },
  [PlayerWeapon.TUNNEL]: {
    id: PlayerWeapon.TUNNEL,
    displayName: 'Tunnel',
    constructor: TunnelWeapon,
    slot: 5,
  },
} as const satisfies Record<PlayerWeapon, WeaponDef>

export type WeaponSlot = typeof WEAPONS[PlayerWeapon]['slot']

export const SLOT_TO_WEAPON = Object.fromEntries(Object.values(WEAPONS).map((val) => {
  return [val.slot, val]
}))
