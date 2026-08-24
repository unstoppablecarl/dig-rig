import { InputController } from '../Input/InputController/InputController.ts'
import { PlayerWeapon } from './weapons.ts'

export type WeaponDef = {
  id: PlayerWeapon,
  displayName: string
  constructor: typeof InputController
  slot: number
}