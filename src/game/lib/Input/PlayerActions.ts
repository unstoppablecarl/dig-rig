import type { GameLevel } from '../../scenes/GameLevel.ts'
import { CompositeActionInput } from './PlayerActions/CompositeActionInput.ts'
import { KeyActionInput } from './PlayerActions/KeyActionInput.ts'
import { PointerActionInput } from './PlayerActions/PointerActionInput.ts'

export enum PlayerAction {
  CHARGE_INCREASE = 'CHARGE_INCREASE',
  CHARGE_DECREASE = 'CHARGE_DECREASE',
  PREV_MODE = 'PREV_MODE',
  NEXT_MODE = 'NEXT_MODE',
  FIRE_PRIMARY = 'FIRE_PRIMARY',
  FIRE_SECONDARY = 'FIRE_SECONDARY',
  MOVE_DOWN = 'MOVE_DOWN',
  MOVE_LEFT = 'MOVE_LEFT',
  MOVE_RIGHT = 'MOVE_RIGHT',
  JUMP = 'JUMP',
  ZOOM_MODIFIER = 'ZOOM_MODIFIER',
  PREV_MATTER = 'PREV_MATTER',
  NEXT_MATTER = 'NEXT_MATTER',
}

export const PLAYER_ACTION_DISPLAY_NAME: Record<PlayerAction, string> = {
  [PlayerAction.MOVE_LEFT]: 'Move Left',
  [PlayerAction.MOVE_RIGHT]: 'Move Right',
  [PlayerAction.MOVE_DOWN]: 'Move Down (debug only)',
  [PlayerAction.JUMP]: 'Jump',
  [PlayerAction.FIRE_PRIMARY]: 'Fire: Primary',
  [PlayerAction.FIRE_SECONDARY]: 'Fire: Secondary',
  [PlayerAction.PREV_MODE]: 'Mode: Prev',
  [PlayerAction.NEXT_MODE]: 'Mode: Next',
  [PlayerAction.CHARGE_DECREASE]: 'Charge: Decrease',
  [PlayerAction.CHARGE_INCREASE]: 'Charge: Increase',
  [PlayerAction.ZOOM_MODIFIER]: 'Zoom',
  [PlayerAction.PREV_MATTER]: 'Matter: Prev',
  [PlayerAction.NEXT_MATTER]: 'Matter: Next',
}

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

export type PlayerActions = Record<PlayerAction, ActionInput>

export function makePlayerActions(scene: GameLevel, bindings: Record<PlayerAction, Binding>): PlayerActions {
  return Object.fromEntries(Object.keys(PlayerAction).map(key => {
    return [key as PlayerAction, makeActionInput(scene, bindings[key as PlayerAction])]
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