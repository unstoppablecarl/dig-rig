import { Input } from 'phaser'
import { type Binding, PlayerAction, POINTER_LEFT, POINTER_RIGHT } from './game/lib/Input/PlayerActions.ts'

const { LEFT, RIGHT, UP, DOWN, SPACE } = Input.Keyboard.KeyCodes

export const INPUT_ACTIONS: Record<PlayerAction, Binding> = {
  [PlayerAction.CHARGE_DECREASE]: ['['],
  [PlayerAction.CHARGE_INCREASE]: [']'],
  [PlayerAction.PREV_MODE]: ['r'],
  [PlayerAction.NEXT_MODE]: ['f'],
  [PlayerAction.FIRE_PRIMARY]: [POINTER_LEFT],
  [PlayerAction.FIRE_SECONDARY]: [POINTER_RIGHT],
  [PlayerAction.MOVE_LEFT]: [LEFT, 'a'],
  [PlayerAction.MOVE_RIGHT]: [RIGHT, 'd'],
  [PlayerAction.MOVE_DOWN]: [DOWN, 's'],
  [PlayerAction.JUMP]: [UP, SPACE, 'w'],
  [PlayerAction.ZOOM_MODIFIER]: ['SHIFT'],
  [PlayerAction.PREV_MATTER]: ['q'],
  [PlayerAction.NEXT_MATTER]: ['e'],
}