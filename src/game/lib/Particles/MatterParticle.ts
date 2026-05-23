import { Display, GameObjects, Math as PMath } from 'phaser'
import { DRAW_PARTICLE_DEBUG } from '../../config.ts'
import { makeSimplexNoise } from '../../helpers/noise.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { ParticleTarget, Position } from '../../types.ts'
import Color = Display.Color
import Interpolate = Display.Color.Interpolate

import Particle = GameObjects.Particles.Particle
import ParticleEmitter = GameObjects.Particles.ParticleEmitter
import DegToRad = PMath.DegToRad
import Bezier = PMath.Interpolation.Bezier
import Vector2 = PMath.Vector2

export const PARTICLE_SIZE = 16
export const PARTICLE_BASE_SCALE = 1 / PARTICLE_SIZE

const LIFESPAN_MS = 10 * 1000
const ARRIVAL_DISTANCE = 50

const STATIC_TARGET_INIT_SPEED_MIN = 120
const STATIC_TARGET_INIT_SPEED_MAX = 200
const STATIC_ANGLE_VARIANCE = DegToRad(90)
const STATIC_FINAL_HOMING_SPEED = 300

const DYNAMIC_INIT_SPEED_MIN = 150
const DYNAMIC_INIT_SPEED_MAX = 300
const DYNAMIC_MAX_SPEED = 300
const DYNAMIC_FINAL_HOMING_DISTANCE = 150
// how fast the transition happens
const DYNAMIC_FINAL_HOMING_TRANSITION_SPEED = 5

const DRAG_COEFFICIENT = 2.5

const WIND_STRENGTH = 800
const NOISE_SCALE = 0.1
const NOISE_TIME_SCALE = 0.01

const ATTRACTION_STRENGTH = 500

const ATTRACTION_RAMP_DISTANCE = 60
const ATTRACTION_RAMP_POWER = 1.5

const STATIC_TARGET_SNAP = 1
const DYNAMIC_TARGET_SNAP = 2

//seconds
const FADE_TIME = 1

const SCALE_INTERPOLATION = [1, 3, 1].map(v => PARTICLE_BASE_SCALE * v)

const noise = makeSimplexNoise(NOISE_SCALE, NOISE_TIME_SCALE)

export class MatterParticle extends Particle {
  private target: Position | ParticleTarget | null = null
  private colorFrom: Color
  private colorTo: Color

  private initialDistance: number
  private fading: boolean
  private noiseTime: number
  private staticTarget: boolean
  private homingTransitionProgress: number

  // trying to only re-use Vector2 objects
  // to avoid GC pressure
  private toTarget = new Vector2()
  private nextVelocity = new Vector2()
  private tempVec2 = new Vector2()
  private noiseVec2 = new Vector2()
  private localWindScale: number
  private localScale: number

  constructor(emitter: ParticleEmitter) {
    super(emitter)
  }

  public init(
    target: Position | ParticleTarget,
    staticTarget: boolean,
    colorFrom: Color,
    colorTo: Color,
  ) {
    this.target = target
    this.colorFrom = colorFrom
    this.colorTo = colorTo
    this.staticTarget = staticTarget
    this.scaleX = this.scaleY = 0
    this.initialDistance = 0
    this.fading = false
    this.alpha = 1
    this.noiseTime = 0
    this.homingTransitionProgress = 0
    this.life = this.lifeCurrent = LIFESPAN_MS

    const dx = target.x - this.x
    const dy = target.y - this.y
    this.initialDistance = Math.sqrt(dx * dx + dy * dy)

    let angle: number
    let initialSpeed: number
    if (staticTarget) {
      angle = Math.atan2(dy, dx)
      angle += PMath.FloatBetween(-STATIC_ANGLE_VARIANCE, STATIC_ANGLE_VARIANCE)
      initialSpeed = PMath.FloatBetween(STATIC_TARGET_INIT_SPEED_MIN, STATIC_TARGET_INIT_SPEED_MAX)
    } else {
      // random angle
      angle = Math.random() * 2 * Math.PI
      initialSpeed = PMath.FloatBetween(DYNAMIC_INIT_SPEED_MIN, DYNAMIC_INIT_SPEED_MAX)
    }

    this.velocityX = Math.cos(angle) * initialSpeed
    this.velocityY = Math.sin(angle) * initialSpeed

    this.localWindScale = PMath.FloatBetween(0.5, 1.5) * WIND_STRENGTH
    this.localScale = PMath.FloatBetween(0.5, 1.5)
  }

  public update(delta: number, step: number): boolean {
    this.noiseTime += delta
    this.lifeCurrent -= delta
    this.lifeT = 1 - (this.lifeCurrent / this.life)

    if (!this.target) {
      this.onKill()
      return true
    }

    if (this.fading) {
      if (!this.staticTarget) {
        this.x = this.target.x
        this.y = this.target.y
        this.onKill()
        return true
      }
      this.alpha -= (1 / FADE_TIME) * (delta / 1000)
      if (this.alpha <= 0) {
        this.onKill()
        return true
      }
      return false
    }

    const toTarget = this.toTarget.copy(this.target).subtract(this)
    const distance = toTarget.length()

    // end snap
    const staticTargetSnap = distance < STATIC_TARGET_SNAP
    const dynamicTargetSnap = distance < DYNAMIC_TARGET_SNAP && !this.staticTarget
    if (staticTargetSnap || dynamicTargetSnap) {
      this.x = this.target.x
      this.y = this.target.y
      this.fading = true
      this.velocityX = 0
      this.velocityY = 0
      return false
    }

    let newVelocity: Vector2
    if (this.staticTarget) {
      newVelocity = this.getVelocityForStaticTarget(step, toTarget, distance)
    } else {
      newVelocity = this.getVelocityForDynamicTarget(step, distance, this.lifeT)
    }

    const dragFactor = 1 - DRAG_COEFFICIENT * step
    const windForce = noise(this, this.noiseTime, this.noiseVec2).scale(this.localWindScale)

    newVelocity
      .add(windForce.scale(step))
      .scale(dragFactor)

    this.velocityX = newVelocity.x
    this.velocityY = newVelocity.y

    this.x += this.velocityX * step
    this.y += this.velocityY * step

    const distanceProgress = 1 - Math.min(1, distance / this.initialDistance)
    this.scaleX = this.scaleY = Bezier(SCALE_INTERPOLATION, distanceProgress) * this.localScale

    this.tint = Interpolate.ColorWithColor(
      this.colorFrom,
      this.colorTo,
      1,
      distanceProgress,
    ).color

    if (DRAW_PARTICLE_DEBUG && this.target) {
      (this.emitter.scene as GameLevel).particleManager
        ?.debugGraphics
        ?.moveTo(this.x, this.y)
        ?.lineTo(this.target.x, this.target.y)
        ?.stroke()
    }

    const dead = this.lifeCurrent <= 0
    if (dead) {
      this.onKill()
    }

    return dead
  }

  private getVelocityForStaticTarget(
    step: number,
    toTarget: Vector2,
    distance: number,
  ) {

    if (distance > ARRIVAL_DISTANCE) {
      this.nextVelocity
        .set(this.velocityX, this.velocityY)
        .add(attractStatic(toTarget, distance).scale(step))
    }
    // smooth deceleration behavior for the final approach
    else {
      const directionToTarget = this.tempVec2.copy(toTarget).normalize()
      let easeFactor = PMath.Easing.Sine.In(distance / ARRIVAL_DISTANCE)
      easeFactor = PMath.Linear(easeFactor, 1, 0.1)
      const newSpeed = STATIC_FINAL_HOMING_SPEED * easeFactor
      this.nextVelocity.copy(directionToTarget.scale(newSpeed))
    }

    return this.nextVelocity
  }

  private getVelocityForDynamicTarget(
    step: number,
    distance: number,
    lifeT: number,
  ): Vector2 {

    const predictedTargetPosition = getPredictedTargetPursuitPosition(this.target as ParticleTarget, distance)
    const toPredictedTarget = predictedTargetPosition.subtract(this)
    const predictedDistance = toPredictedTarget.length()

    const isFinalHoming = predictedDistance < DYNAMIC_FINAL_HOMING_DISTANCE || lifeT > 0.5

    if (isFinalHoming) {
      const directionToPredictedTarget = toPredictedTarget.normalize()
      const targetHomingVelocity = directionToPredictedTarget.scale(DYNAMIC_MAX_SPEED)

      const newProgress = this.homingTransitionProgress + step * DYNAMIC_FINAL_HOMING_TRANSITION_SPEED
      this.homingTransitionProgress = Math.min(1, newProgress)

      const easedT = PMath.Easing.Sine.InOut(this.homingTransitionProgress)

      const easedVelocityX = PMath.Linear(this.velocityX, targetHomingVelocity.x, easedT)
      const easedVelocityY = PMath.Linear(this.velocityY, targetHomingVelocity.y, easedT)

      return this.nextVelocity.set(easedVelocityX, easedVelocityY)
    }

    this.nextVelocity.set(this.velocityX, this.velocityY)

    // fallback to normal attraction behavior for far distances
    if (predictedDistance > 0) {
      this.nextVelocity.add(attractDynamic(toPredictedTarget, this.lifeT).scale(step))
    }

    return this.nextVelocity
  }

  private onKill() {
    this.target = null
  }

  destroy() {
    super.destroy()
    this.target = null

    // @ts-expect-error: destroy
    this.colorFrom = null
    // @ts-expect-error: destroy
    this.colorTo = null
    // @ts-expect-error: destroy
    this.toTarget = null
    // @ts-expect-error: destroy
    this.nextVelocity = null
    // @ts-expect-error: destroy
    this.tempVec2 = null
    // @ts-expect-error: destroy
    this.noiseVec2 = null
  }
}

const attractStatic = (() => {
  // re-used vector2 instances
  const v1 = new Vector2()

  return (toTarget: Vector2, predictedDistance: number) => {
    const directionToPredictedTarget = v1.copy(toTarget).normalize()
    const distanceMultiplier = Math.min(1, Math.pow(predictedDistance / ATTRACTION_RAMP_DISTANCE, ATTRACTION_RAMP_POWER))
    const strength = ATTRACTION_STRENGTH * distanceMultiplier

    return directionToPredictedTarget.scale(strength)
  }
})()

const attractDynamic = (() => {
  // re-used vector2 instances
  const v1 = new Vector2()

  return (toTarget: Vector2, lifeT: number) => {
    const directionToPredictedTarget = v1.copy(toTarget).normalize()
    const strength = PMath.Linear(ATTRACTION_STRENGTH, ATTRACTION_STRENGTH * 2, lifeT)

    return directionToPredictedTarget.scale(strength)
  }
})()

const getPredictedTargetPursuitPosition = (() => {
  // re-used vector2 instances
  const v1 = new Vector2()
  const v2 = new Vector2()

  return (target: ParticleTarget, distance: number) => {
    const targetVelocity = v1.copy(target).subtract(target.prevPosition)
    const timeToIntercept = distance / DYNAMIC_MAX_SPEED
    const targetVelocityAfterTime = targetVelocity.scale(timeToIntercept)

    return v2.copy(target).add(targetVelocityAfterTime)
  }
})()