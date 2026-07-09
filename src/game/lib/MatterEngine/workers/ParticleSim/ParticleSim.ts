import { FILL_MAX } from '../../../Matter/_Liquid.constants.ts'
import { EMPTY, matterType, MatterType, type MatterValue, SupportType } from '../../../Matter/_Matter.types.ts'
import { convertsToCollisionBody, getSupportType, isLiquid } from '../../../Matter/matter.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../../../Matter/Tank/_MatterTank.types.ts'
import { ParticleType } from '../../../Particles/_particle-types.ts'
import type { Particle } from '../../../Particles/Particle.ts'
import { PARTICLE_DEFS } from '../../../Particles/particles.ts'
import { ParticleData, type ParticlesBuffers } from '../../data/ParticleData.ts'
import type { ConservationTracker } from '../Coordinator/ConservationTracker.ts'
import { ParticlePool } from './ParticlePool.ts'

export class ParticleSim {
  width = 0
  height = 0
  pool!: ParticlePool
  pendingActivations: number[] = []
  structuralRemovals: number[] = []
  data!: ParticleData

  constructor(
    readonly tiles: Uint32Array,
    readonly fill: Uint32Array,
    readonly conservationTracker: ConservationTracker,
    particleBuffers: ParticlesBuffers,
  ) {
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

  spawn<T extends ParticleType>(
    type: T,
    x: number,
    y: number,
    ownerId: MatterTankId = NO_MATTER_TANK_ID,
    vx: number = 0,
    vy: number = 0,
    value: MatterValue = EMPTY,
  ) {
    const def = PARTICLE_DEFS[type]!
    if (!def || !this.pool) return
    def.spawn(this.pool, this, type, x, y, ownerId, vx, vy, value)
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
    // Liquids track their mass in the parallel `fill` array, not the tile bits — a liquid
    // tile written without this stays at whatever fill (often 0) was already there and
    // becomes a zero-fill "zombie" the sim treats as empty. See MatterSim's Brush placement
    // for the same pattern.
    if (isLiquid(type)) {
      this.fill[idx] = FILL_MAX
    }
    this.pendingActivations.push(idx)
  }

  setTile(idx: number, type: MatterValue) {
    this.tiles[idx] = type
    if (isLiquid(matterType(type))) {
      this.fill[idx] = FILL_MAX
    }
    this.pendingActivations.push(idx)
  }

  // Adds a small amount of liquid to a tile instead of snapping it to FILL_MAX — for
  // particles (e.g. water splash droplets) that carry a fixed, conserved fill amount rather
  // than a full tile's worth. Refuses to overwrite a tile occupied by a different matter type
  // (returns false so the caller knows the droplet's mass wasn't deposited — e.g. it landed on
  // solid ground and should be treated as consumed rather than credited back).
  depositLiquid(idx: number, type: MatterValue, amount: number): boolean {
    const raw = this.tiles[idx]
    const curType = matterType(raw)
    const depositType = matterType(type)
    if (curType !== MatterType.EMPTY && curType !== depositType) return false
    if (curType === MatterType.EMPTY) this.tiles[idx] = type
    this.fill[idx] = Math.min(FILL_MAX, this.fill[idx] + amount)
    this.pendingActivations.push(idx)
    return true
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

  // Sweeps from origin (x0, y0) along delta (dx, dy) and returns the tile index of the
  // last tile before the first one a physics body would collide with (see
  // convertsToCollisionBody), or undefined if the whole path is clear.
  checkForCollision(x0: number, y0: number, dx: number, dy: number): number | undefined {
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.ceil(dist * 2))

    const width = this.width
    const tiles = this.tiles

    let prevIdx = Math.round(y0) * width + Math.round(x0)
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const ox = Math.round(x0 + dx * t)
      const oy = Math.round(y0 + dy * t)
      const idx = oy * width + ox
      if (idx === prevIdx) continue
      if (convertsToCollisionBody(tiles[idx])) {
        return prevIdx
      }
      prevIdx = idx
    }
  }
}