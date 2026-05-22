import type { Weapon } from './Input/InputControllers/WeaponManagerInput.ts'

export enum GameEvent {
  UI_WEAPON_UPDATE = 'UI_WEAPON_UPDATE',
  MESSAGE = 'MESSAGE',
}

export interface EventMap {
  [GameEvent.UI_WEAPON_UPDATE]: [Weapon]
  [GameEvent.MESSAGE]: [string]
}

