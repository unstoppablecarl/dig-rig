import type { MatterTankId } from '../Matter/Tank/_MatterTank.types.ts'
import { ParticleType } from './_particle-types.ts'

export class Particle {
  particleType: ParticleType
  x: number = 0
  y: number = 0
  // 0xRRGGBB
  color: number = 0
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

  // Generic extra fields used by specific particle types
  data: Record<string, number> = {}

  reset() {
    this.particleType = ParticleType.NONE
    this.x = this.y = 0
    this.color = 0
    this.velocity = this.angle = 0
    this.xVelocity = this.yVelocity = 0
    this.size = 0
    this.actionIterations = 0
    this.active = false
    this.next = this.prev = null
    this.data = {}
  }

  setVelocity(velocity: number, angle: number) {
    this.velocity = velocity
    this.angle = angle
    this.xVelocity = velocity * Math.cos(angle)
    this.yVelocity = velocity * Math.sin(angle)
  }
}
