import { MatterType } from '../Matter/_Matter.types.ts'
import type { LiquidTypes } from '../Matter/matter.ts'
import type { MatterTankId } from '../Matter/Tank/_MatterTank.types.ts'
import { ParticleType } from './_particle-types.ts'

export class Particle {
  particleType: ParticleType
  x: number = 0
  y: number = 0
  velocity: number = 0
  angle: number = 0
  xVelocity: number = 0
  yVelocity: number = 0
  size: number = 0
  actionIterations: number = 0
  active: boolean = false
  next: Particle | null = null
  prev: Particle | null = null
  ownerId: MatterTankId

  initX: number = 0
  initY: number = 0
  minY: number = 0
  initYVelocity: number = 0
  yAcceleration: number = 0
  maxIterations: number = 0

  liquidType: LiquidTypes = MatterType.WATER

  reset() {
    this.particleType = ParticleType.NONE
    this.x = this.y = 0
    this.velocity = 0
    this.angle = 0
    this.xVelocity = this.yVelocity = 0
    this.size = 0
    this.actionIterations = 0
    this.active = false
    this.next = this.prev = null
  }

  setVelocity(velocity: number, angle: number) {
    this.velocity = velocity
    this.angle = angle
    this.xVelocity = velocity * Math.cos(angle)
    this.yVelocity = velocity * Math.sin(angle)
  }
}
