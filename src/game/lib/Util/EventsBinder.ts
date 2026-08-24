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

  addInputHoldRepeat(
    key: { onDown(cb: () => void): () => void; onUp(cb: () => void): () => void },
    cb: () => void,
    initialDelayMs = 350,
    repeatMs = 80,
  ): this {
    this._inputBindings.push(
      () => {
        let delayId: ReturnType<typeof setTimeout> | null = null
        let intervalId: ReturnType<typeof setInterval> | null = null
        const start = () => {
          cb()
          delayId = setTimeout(() => {
            intervalId = setInterval(cb, repeatMs)
          }, initialDelayMs)
        }
        const stop = () => {
          if (delayId !== null) {
            clearTimeout(delayId)
            delayId = null
          }
          if (intervalId !== null) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
        return [key.onDown(start), key.onUp(stop), stop]
      },
    )
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
