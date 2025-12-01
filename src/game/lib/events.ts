import type { Weapon } from './Player/Weapons/PlayerWeaponManager.ts'

export const EVENT_WEAPON_SELECTED = 'EVENT_WEAPON_SELECTED'
export const EVENT_MESSAGE = 'EVENT_MESSAGE'

export interface EventMap {
  [EVENT_WEAPON_SELECTED]: [Weapon];
  [EVENT_MESSAGE]: [string]
}

