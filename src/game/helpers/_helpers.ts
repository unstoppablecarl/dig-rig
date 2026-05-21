import { GameObjects, Physics } from 'phaser'
import { FireMode, type MatterTankFireMode } from '../config.ts'
import type { ParticleTarget, Position } from '../types.ts'
import GameObject = GameObjects.GameObject
import Velocity = Physics.Matter.Components.Velocity

export function clampMaxInt(value: number, max: number) {
  let m = value
  m = Math.min(m, max)
  m = Math.max(m, 0)
  return Math.floor(m)
}

export function getCollisionSteps(vx: number, vy: number, dt: number, scale = 1) {

  const dx = vx * dt
  const dy = vy * dt

  // sub-stepping: tile-sized steps for collision checks
  const stepsX = Math.ceil(Math.abs(dx) * scale)
  const stepsY = Math.ceil(Math.abs(dy) * scale)
  const totalSteps = Math.max(stepsX, stepsY, 1)

  return {
    dx,
    dy,
    stepDx: dx / totalSteps,
    stepDy: dy / totalSteps,
    totalSteps,
  }
}

// avoid speedup on laggy frames (30 FPS max step)
export const getDeltaT = (delta: number) => Math.min(delta / 1000, 1 / 30)

export class PositionOffset implements ParticleTarget {

  public flipX = false

  constructor(
    private target: ParticleTarget,
    private _x: number = 0,
    private _y: number = 0,
    public maxVelocity = target.maxVelocity,
  ) {
  }

  getOffset() {
    return {
      x: this._x,
      y: this._y,
    }
  }

  get x() {
    return this.target.x + (this.flipX ? -this._x : this._x)
  }

  get y() {
    return this.target.y + this._y
  }

  get prevPosition(): Position {
    return {
      x: this.target.prevPosition.x + this._x,
      y: this.target.prevPosition.y + this._y,
    }
  }
}

export function getFactor(min: number, max: number, current: number) {
  // Handle potential division by zero if min and max are the same
  if (min === max) {
    return min === current ? 1 : 0
  }

  return (current - min) / (max - min)
}

export function clampVelocity(t: Velocity & GameObject, max: number): void {
  const v = t.body!.velocity
  if (v.x === 0 && v.y === 0) return

  // does exist but isn't in types
  const speed = (t.body as any).speed as unknown as number

  // Add 10% buffer - only clamp if we're meaningfully over
  if (speed < max * 1.1) {
    return
  }

  const normalizedX = v.x / speed
  const normalizedY = v.y / speed

  const newVX = normalizedX * max
  const newVY = normalizedY * max

  t.setVelocity(newVX, newVY)
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  let lastArgs: Parameters<T> | undefined
  let lastThis: ThisParameterType<T> | undefined

  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    lastArgs = args
    lastThis = this

    if (!inThrottle) {
      func.apply(lastThis, lastArgs)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

export type DebouncedFunction<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => Promise<ReturnType<T>>;

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): DebouncedFunction<T> => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let resolvePromise: ((value: ReturnType<T>) => void) | null = null

  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    return new Promise<ReturnType<T>>(resolve => {
      if (timeout) {
        clearTimeout(timeout)
      }
      resolvePromise = resolve

      timeout = setTimeout(() => {
        const result = func.apply(this, args)
        if (resolvePromise) {
          resolvePromise(result)
        }
        timeout = null
        resolvePromise = null
      }, wait)
    })
  }
}

export function makeBitmaskIncrementer() {
  let maskIncrement = 1

  return () => {
    const result = maskIncrement
    maskIncrement *= 2
    return result
  }
}

export const isMatterTankFireMode = (mode: FireMode): mode is MatterTankFireMode => mode === FireMode.CREATE || mode === FireMode.DESTROY