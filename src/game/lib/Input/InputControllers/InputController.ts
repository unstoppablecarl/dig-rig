import { Events } from 'phaser'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'

type Binding = [Events.EventEmitter, string, Function]

export abstract class InputController extends SceneBound<GameLevel> {
  private _enabled = false
  private _bindings: Binding[] = []

  get enabled() { return this._enabled }

  protected bind(emitter: Events.EventEmitter, event: string, handler: Function) {
    this._bindings.push([emitter, event, handler])
  }

  setInputEnabled(value: boolean) {
    if (this._enabled === value) return
    this._enabled = value
    for (const [emitter, event, handler] of this._bindings) {
      value ? emitter.on(event, handler, this) : emitter.off(event, handler, this)
    }
    value ? this.onEnable?.() : this.onDisable?.()
  }

  protected onEnable?(): void
  protected onDisable?(): void

  protected onDestroy() { this.setInputEnabled(false) }
}
