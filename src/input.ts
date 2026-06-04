import { Input } from 'phaser'
import {
  type Binding,
  PlayerAction,
  type PlayerActionKey,
  POINTER_LEFT,
  POINTER_RIGHT,
} from './game/lib/Input/PlayerActions.ts'

const { LEFT, RIGHT, UP, DOWN, SPACE } = Input.Keyboard.KeyCodes

export const INPUT_ACTIONS: Record<PlayerActionKey, Binding> = {
  [PlayerAction.CHARGE_DECREASE]: ['q'],
  [PlayerAction.CHARGE_INCREASE]: ['e'],
  [PlayerAction.PREV_FIRE_MODE]: ['r'],
  [PlayerAction.NEXT_FIRE_MODE]: ['f'],
  [PlayerAction.FIRE_PRIMARY]: [POINTER_LEFT],
  [PlayerAction.FIRE_SECONDARY]: [POINTER_RIGHT],
  [PlayerAction.MOVE_LEFT]: [LEFT, 'a'],
  [PlayerAction.MOVE_RIGHT]: [RIGHT, 'd'],
  [PlayerAction.MOVE_DOWN]: [DOWN, 's'],
  [PlayerAction.JUMP]: [UP, SPACE, 'w'],
  [PlayerAction.ZOOM_MODIFIER]: ['SHIFT'],
}