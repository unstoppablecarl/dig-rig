import type { Weapon } from './Input/InputControllers/WeaponManagerInput.ts'

export enum GameEvent {
  WEAPON_SELECTED = 'WEAPON_SELECTED',
  MESSAGE = 'MESSAGE'
}

export interface EventMap {
  [GameEvent.WEAPON_SELECTED]: [Weapon];
  [GameEvent.MESSAGE]: [string]
}

