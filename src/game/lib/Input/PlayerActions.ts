import type { GameLevel } from '../../scenes/GameLevel.ts'
import { KeyActionInput } from './PlayerActions/KeyActionInput.ts'
import { PointerActionInput } from './PlayerActions/PointerActionInput.ts'

export const PlayerAction = {
  CHARGE_INCREASE: 'CHARGE_INCREASE',
  CHARGE_DECREASE: 'CHARGE_DECREASE',
  PREV_FIRE_MODE: 'PREV_FIRE_MODE',
  NEXT_FIRE_MODE: 'NEXT_FIRE_MODE',
  FIRE_PRIMARY: 'FIRE_PRIMARY',
  FIRE_SECONDARY: 'FIRE_SECONDARY',
  MOVE_DOWN: 'MOVE_DOWN',
  MOVE_LEFT: 'MOVE_LEFT',
  MOVE_RIGHT: 'MOVE_RIGHT',
  JUMP: 'JUMP',
} as const

export type PlayerActionKey = keyof typeof PlayerAction

export const POINTER_LEFT = 'POINTER_LEFT' as const
export const POINTER_RIGHT = 'POINTER_RIGHT' as const
export type PointerBinding = typeof POINTER_LEFT | typeof POINTER_RIGHT

export type KeyBinding = string | number | (string | number)[]
export type Binding = KeyBinding | PointerBinding

export interface ActionInput {
  isDown(): boolean
  isUp(): boolean
  onDown(cb: () => void): () => void
  onUp(cb: () => void): () => void
}

export type PlayerActions = Record<PlayerActionKey, ActionInput>

export function makePlayerActions(scene: GameLevel, bindings: Record<PlayerActionKey, Binding>): PlayerActions {
  return Object.fromEntries(Object.keys(PlayerAction).map(key => {
    return [key as PlayerActionKey, makeActionInput(scene, bindings[key as PlayerActionKey])]
  })) as PlayerActions
}

function makeActionInput(scene: GameLevel, binding: Binding): ActionInput {
  if (binding === POINTER_LEFT) return new PointerActionInput(scene, 'LEFT')
  if (binding === POINTER_RIGHT) return new PointerActionInput(scene, 'RIGHT')
  const keys = Array.isArray(binding) ? binding : [binding]
  return new KeyActionInput(scene, keys)
}


