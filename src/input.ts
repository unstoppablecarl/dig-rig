import { Input } from 'phaser'
import {
  type Binding,
  type KeyEventGuard,
  PlayerAction,
  POINTER_LEFT,
  POINTER_RIGHT,
} from './game/lib/Input/PlayerActions.ts'

const { LEFT, RIGHT, UP, DOWN, SPACE } = Input.Keyboard.KeyCodes

export const INPUT_ACTIONS: Record<PlayerAction, Binding> = {
  [PlayerAction.MOVE_LEFT]: [LEFT, 'a'],
  [PlayerAction.MOVE_RIGHT]: [RIGHT, 'd'],
  [PlayerAction.MOVE_DOWN]: [DOWN, 's'],
  [PlayerAction.JUMP]: [UP, SPACE, 'w'],

  [PlayerAction.ZOOM_MOUSE_WHEEL_MODIFIER]: ['SHIFT'],

  [PlayerAction.FIRE_PRIMARY]: [POINTER_LEFT],
  [PlayerAction.FIRE_SECONDARY]: [POINTER_RIGHT],
  [PlayerAction.CHARGE_DECREASE]: ['['],
  [PlayerAction.CHARGE_INCREASE]: [']'],
  [PlayerAction.PREV_MODE]: ['r'],
  [PlayerAction.NEXT_MODE]: ['f'],
  [PlayerAction.PREV_MATTER_TYPE]: ['q'],
  [PlayerAction.NEXT_MATTER_TYPE]: ['e'],

  [PlayerAction.BRUSH_PRIMARY]: [POINTER_LEFT],
  [PlayerAction.BRUSH_SECONDARY]: [POINTER_RIGHT],
  [PlayerAction.BRUSH_ERASE_MODIFIER]: ['SHIFT'],
  [PlayerAction.BRUSH_MODE_TOGGLE]: ['b'],
}

// prevent input when refreshing the page
export const KEY_EVENT_GUARD: KeyEventGuard = (e) => {
  if (e instanceof KeyboardEvent) {
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
      return false
    }
  }
  return true
}

// prevent default browser actions for:
export const BROWSER_DISABLED_KEYS = [
  Input.Keyboard.KeyCodes.UP,
  Input.Keyboard.KeyCodes.DOWN,
  Input.Keyboard.KeyCodes.LEFT,
  Input.Keyboard.KeyCodes.RIGHT,
  Input.Keyboard.KeyCodes.SPACE,
]