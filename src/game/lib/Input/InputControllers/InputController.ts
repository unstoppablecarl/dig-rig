import { Events } from 'phaser'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { EventsBinder, type InputBinder } from '../../Util/EventsBinder.ts'

export abstract class InputController extends SceneBound<GameLevel> {
  private _enabled = false
  protected binder: EventsBinder

  constructor(scene: GameLevel) {
    super(scene)
    this.binder = new EventsBinder()
  }

  get enabled() {
    return this._enabled
  }

  protected addEvent(emitter: Events.EventEmitter, event: string, handler: Function, context: any = this) {
    this.binder.add(emitter, event, handler, context)
  }

  protected addInput(input: InputBinder | InputBinder[]) {
    this.binder.addInput(input)
  }

  setInputEnabled(value: boolean) {
    if (this._enabled === value) return
    this._enabled = value
    if (value) {
      this.binder.bind()
    } else {
      this.binder.unBind()
    }

    value ? this.onEnable?.() : this.onDisable?.()
  }

  protected onEnable?(): void

  protected onDisable?(): void

  protected onDestroy() {
    this.setInputEnabled(false)
    // @ts-expect-error: destroy
    this.binder = null
  }
}
