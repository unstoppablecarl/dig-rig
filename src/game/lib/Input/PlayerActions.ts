import type { GameLevel } from '../../scenes/GameLevel.ts'
import { CompositeActionInput } from './PlayerActions/CompositeActionInput.ts'
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
  ZOOM_MODIFIER: 'ZOOM_MODIFIER',
} as const

export type PlayerActionKey = keyof typeof PlayerAction

export const POINTER_LEFT = 'Mouse Left' as const
export const POINTER_RIGHT = 'Mouse Right' as const
export type PointerBinding = typeof POINTER_LEFT | typeof POINTER_RIGHT

export type Binding = (string | number | PointerBinding)[]

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
  const keys: (string | number)[] = []
  const inputs: ActionInput[] = []

  for (const item of binding) {
    if (item === POINTER_LEFT) inputs.push(new PointerActionInput(scene, 'LEFT'))
    else if (item === POINTER_RIGHT) inputs.push(new PointerActionInput(scene, 'RIGHT'))
    else keys.push(item)
  }

  if (keys.length) inputs.push(new KeyActionInput(scene, keys))
  if (inputs.length === 1) return inputs[0]
  return new CompositeActionInput(inputs)
}


