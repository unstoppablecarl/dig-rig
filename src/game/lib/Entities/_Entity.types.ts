import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Entity } from './Entity.ts'

export type ConcreteEntityConstructor = new (scene: GameLevel, x: number, y: number, ...args: any[]) => Entity

export type EntitySpawner<T extends ConcreteEntityConstructor = ConcreteEntityConstructor> = {
  id: string,
  constructor: T,
  displayName: string,
  size: { w: number, h: number },
  preload: (scene: GameLevel) => void,
}
