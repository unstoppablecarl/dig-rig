import EventEmitter = Phaser.Events.EventEmitter
import BasePlugin = Phaser.Plugins.BasePlugin
import PluginManager = Phaser.Plugins.PluginManager
import type { EventMap } from '../events.ts'
import DESTROY = Phaser.Core.Events.DESTROY

export class EventsPlugin extends BasePlugin {
  private static EVENTS: EventEmitter

  declare on: <K extends keyof EventMap>(eventName: K, callback: (...args: EventMap[K]) => void, thisArg?: any) => EventEmitter
  declare once: <K extends keyof EventMap>(eventName: K, callback: (...args: EventMap[K]) => void, thisArg?: any) => EventEmitter
  declare emit: <K extends keyof EventMap>(eventName: K, ...args: EventMap[K]) => boolean
  declare off: <K extends keyof EventMap>(eventName: K, callback: (...args: EventMap[K]) => void, thisArg?: any) => EventEmitter

  constructor(pluginManager: PluginManager) {
    super(pluginManager)

    if (!EventsPlugin.EVENTS) {
      EventsPlugin.EVENTS = new EventEmitter()
    }

    let events = EventsPlugin.EVENTS
    this.on = events.on.bind(events) as typeof this.on
    this.once = events.once.bind(events) as typeof this.once
    this.emit = events.emit.bind(events) as typeof this.emit
    this.off = events.off.bind(events) as typeof this.off

    this.game.events.on(DESTROY, () => EventsPlugin.EVENTS.destroy())
  }
}

export interface EventBusInterface {
  on<K extends keyof EventMap>(eventName: K, callback: (...args: EventMap[K]) => void, thisArg?: any): this;
  once<K extends keyof EventMap>(eventName: K, callback: (...args: EventMap[K]) => void, thisArg?: any): this;
  emit<K extends keyof EventMap>(eventName: K, ...args: EventMap[K]): boolean;
  off<K extends keyof EventMap>(eventName: K, callback: (...args: EventMap[K]) => void, thisArg?: any): this;
}

export const pluginEventBusConfig = {
  plugin: EventsPlugin,
  // scene.sys.EVENTS:
  key: 'EVENTS' as 'EVENTS',
  // scene.EVENTS:
  mapping: 'EVENTS' as 'EVENTS',
}

declare module 'phaser' {
  interface Scene {
    [pluginEventBusConfig.mapping]: EventBusInterface;
  }

  namespace Scenes {
    interface Systems {
      [pluginEventBusConfig.key]: EventBusInterface;
    }
  }
}