import { MAX_PARTICLES } from '../../../../config.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../../../Matter/Tank/_MatterTank.types.ts'
import type { ParticleType } from '../../../Particles/_particle-types.ts'
import { Particle } from '../../../Particles/Particle.ts'


export class ParticlePool {

  // Doubly-linked lists
  private activeHead: Particle | null = null
  private inactiveHead: Particle | null = null

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = new Particle()
      p.next = this.inactiveHead
      if (this.inactiveHead) this.inactiveHead.prev = p
      this.inactiveHead = p
    }
  }

  acquire(type: ParticleType, x: number, y: number, ownerId: MatterTankId = NO_MATTER_TANK_ID): Particle | null {
    if (!this.inactiveHead) return null

    const p = this.inactiveHead
    this.inactiveHead = p.next
    if (this.inactiveHead) this.inactiveHead.prev = null

    p.reset()
    p.particleType = type
    p.x = x
    p.y = y
    p.active = true
    p.ownerId = ownerId

    // Prepend to active list
    p.next = this.activeHead
    p.prev = null
    if (this.activeHead) this.activeHead.prev = p
    this.activeHead = p

    return p
  }

  release(p: Particle) {
    if (!p.active) return
    p.active = false

    // Unlink from active
    if (p.prev) p.prev.next = p.next
    else this.activeHead = p.next
    if (p.next) p.next.prev = p.prev

    // Prepend to inactive
    p.next = this.inactiveHead
    p.prev = null
    if (this.inactiveHead) this.inactiveHead.prev = p
    this.inactiveHead = p
  }

  forEachActive(cb: (p: Particle) => void) {
    let p = this.activeHead
    while (p) {
      const next = p.next
      cb(p)
      p = next
    }
  }

  get isEmpty(): boolean {
    return this.activeHead === null
  }

  get activeCount(): number {
    let count = 0
    let p = this.activeHead
    while (p) {
      count++
      p = p.next
    }
    return count
  }
}
