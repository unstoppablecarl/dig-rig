import { Input } from 'phaser'
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
  PREV_MATTER_TYPE = 'PREV_MATTER_TYPE',
  NEXT_MATTER_TYPE = 'NEXT_MATTER_TYPE',
  BRUSH_PRIMARY = 'BRUSH_PRIMARY',
  BRUSH_SECONDARY = 'BRUSH_SECONDARY',
  BRUSH_ERASE_MODIFIER = 'BRUSH_ERASE_MODIFIER',
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
  [PlayerAction.PREV_MATTER_TYPE]: 'Matter: Prev',
  [PlayerAction.NEXT_MATTER_TYPE]: 'Matter: Next',
  [PlayerAction.BRUSH_PRIMARY]: 'Paint: Primary',
  [PlayerAction.BRUSH_SECONDARY]: 'Paint: Secondary',
  [PlayerAction.BRUSH_ERASE_MODIFIER]: 'Paint: Erase',
}

export const POINTER_LEFT = 'LMB' as const
export const POINTER_RIGHT = 'RMB' as const
export type PointerBinding = typeof POINTER_LEFT | typeof POINTER_RIGHT

export type Binding = (string | number | PointerBinding)[]
export type KeyEvent = (e: KeyboardEvent | Input.Pointer) => void
export type KeyEventGuard = (e: KeyboardEvent | Input.Pointer) => boolean

export interface ActionInput {
  isDown(): boolean
  isUp(): boolean
  onDown(cb: KeyEvent): () => void
  onUp(cb: KeyEvent): () => void
}

export type PlayerActions = Record<PlayerAction, ActionInput>

export function makePlayerActions(scene: GameLevel, bindings: Record<PlayerAction, Binding>, guard?: KeyEventGuard): PlayerActions {
  return Object.fromEntries(Object.keys(PlayerAction).map(key => {
    return [key as PlayerAction, makeActionInput(scene, bindings[key as PlayerAction], guard)]
  })) as PlayerActions
}

export function makeActionInput(scene: GameLevel, binding: Binding, guard?: KeyEventGuard): ActionInput {
  const keys: (string | number)[] = []
  const inputs: ActionInput[] = []

  for (const item of binding) {
    if (item === POINTER_LEFT) {
      inputs.push(new PointerActionInput(scene, 'LEFT'))
    } else if (item === POINTER_RIGHT) {
      inputs.push(new PointerActionInput(scene, 'RIGHT'))
    } else {
      keys.push(item)
    }
  }

  if (keys.length) {
    inputs.push(new KeyActionInput(scene, keys))
  }

  return new CompositeActionInput(inputs, guard)
}