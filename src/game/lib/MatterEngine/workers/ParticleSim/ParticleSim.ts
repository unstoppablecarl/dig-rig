import { matterType, MatterType, SupportType } from '../../../Matter/_Matter.types.ts'
import { getSupportType } from '../../../Matter/matter.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../../../Matter/Tank/_MatterTank.types.ts'
import { ParticleType } from '../../../Particles/_particle-types.ts'
import type { Particle } from '../../../Particles/Particle.ts'
import { PARTICLE_DEFS } from '../../../Particles/particles.ts'
import { ParticleData, type ParticlesBuffers } from '../../data/ParticleData.ts'
import { ParticlePool } from './ParticlePool.ts'

export class ParticleSim {
  width = 0
  height = 0
  pool!: ParticlePool
  pendingActivations: number[] = []
  structuralRemovals: number[] = []
  data!: ParticleData

  constructor(readonly tiles: Uint32Array, particleBuffers: ParticlesBuffers) {
    this.width = particleBuffers.width
    this.height = particleBuffers.height
    this.data = new ParticleData(particleBuffers)
    this.pool = new ParticlePool()
  }

  step() {
    this.data.clear()
    this.pendingActivations.length = 0
    this.structuralRemovals.length = 0

    this.pool.forEachActive((p) => {
      if (p.particleType === ParticleType.NONE) {
        this.pool.release(p)
        return
      }

      const def = PARTICLE_DEFS[p.particleType]
      def.action(p, this)
      p.actionIterations++
    })

    this.data.publish()
  }

  spawn(type: ParticleType, x: number, y: number, ownerId: MatterTankId = NO_MATTER_TANK_ID, initArgs: unknown[] = []) {
    const def = PARTICLE_DEFS[type]
    if (!def || !this.pool) return
    for (let i = 0; i < def.particlesToSpawn; i++) {
      const p = this.pool.acquire(type, x, y, ownerId)
      if (!p) break
        ;
      (def.init as (p: Particle, sim: ParticleSim, ...args: unknown[]) => void)(p, this, ...initArgs)
    }
  }

  getTileType(x: number, y: number): MatterType {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return MatterType.PERMANENT
    return matterType(this.tiles[y * this.width + x])
  }

  fillTile(x: number, y: number, type: MatterType) {
    const width = this.width
    if (x < 0 || x >= width || y < 0 || y >= this.height) return
    const tiles = this.tiles
    const idx = y * width + x
    const raw = tiles[idx]
    if (matterType(raw) === MatterType.PERMANENT) return
    if (getSupportType(raw) >= SupportType.STRUCTURAL && getSupportType(type) < SupportType.STRUCTURAL) {
      this.structuralRemovals.push(idx)
    }
    tiles[idx] = type
    this.pendingActivations.push(idx)
  }

  tileAtTip(p: Particle): MatterType {
    const radius = p.size / 2
    const theta = Math.atan2(p.yVelocity, p.xVelocity)
    const tx = Math.round(p.x + Math.cos(theta) * radius)
    const ty = Math.round(p.y + Math.sin(theta) * radius)
    const width = this.width
    if (tx < 0 || tx >= width || ty < 0 || ty >= this.height) return MatterType.EMPTY
    return matterType(this.tiles[ty * width + tx]) as MatterType
  }

  outOfBounds(p: Particle): boolean {
    return p.x < 0 || p.x >= this.width || p.y < 0 || p.y >= this.height
  }

  fillCircle(x: number, y: number, radius: number, value: number) {
    const r = Math.max(1, Math.round(radius))
    const cx = Math.round(x)
    const cy = Math.round(y)
    const { width, height } = this
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const px = cx + dx
        const py = cy + dy
        if (px < 0 || px >= width || py < 0 || py >= height) continue
        this.fillTile(px, py, value)
      }
    }
  }

  fillLine(x1: number, y1: number, x2: number, y2: number, size: number, value: number) {
    const radius = Math.max(0.5, size / 2)
    const dx = x2 - x1
    const dy = y2 - y1
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), 1))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      this.fillCircle(x1 + dx * t, y1 + dy * t, radius, value)
    }
  }
}
