import { InputController } from '../Input/InputControllers/InputController.ts'
import { PlayerWeapon } from './weapons.ts'

export type WeaponDef = {
  id: PlayerWeapon,
  displayName: string
  constructor: typeof InputController
  slot: number
}