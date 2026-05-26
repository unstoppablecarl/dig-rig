import { Events } from 'phaser'
import type { EventBusInterface } from '../plugins/events-plugin.ts'

type AnyEmitter = Events.EventEmitter | EventBusInterface

type InternalBinding = {
  emitter: { on(event: any, fn: any, context?: any): any; off(event: any, fn: any, context?: any): any }
  event: any
  handler: Function
  context: any
}

export type InputBinder = (() => InputUnBinder)
export type InputUnBinder = (() => void) | (() => void)[]

export class EventsBinder {
  private _bindings: InternalBinding[] = []
  private _bound = false

  private _inputBindings: InputBinder[] = []
  private _inputUnBindings: (() => void)[] = []

  addInput(input: InputBinder | InputBinder[]) {
    const bindings = Array.isArray(input) ? input : [input]

    this._inputBindings.push(...bindings)

    return this
  }

  add<T extends AnyEmitter>(emitter: T, event: Parameters<T['on']>[0], handler: Function, context?: any): this {
    this._bindings.push({ emitter, event, handler, context })
    return this
  }

  bind() {
    if (this._bound) return
    for (const { emitter, event, handler, context } of this._bindings) {
      emitter.on(event, handler, context)
    }
    for (const fn of this._inputBindings) {
      const reverse = fn()
      const unBindings = Array.isArray(reverse) ? reverse : [reverse]
      this._inputUnBindings.push(...unBindings)
    }
    this._bound = true
  }

  unBind() {
    if (!this._bound) return
    for (const { emitter, event, handler, context } of this._bindings) {
      emitter.off(event, handler, context)
    }
    for (const fn of this._inputUnBindings) {
      fn()
    }
    this._inputUnBindings = []
    this._bound = false
  }
}
