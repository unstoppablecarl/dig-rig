import { FILL_MAX } from '../../../Matter/_Liquid.constants.ts'
import { EMPTY, matterType, MatterType, type MatterValue, SupportType } from '../../../Matter/_Matter.types.ts'
import type { MatterTypeSet } from '../../../Matter/data/MatterTypeSet.ts'
import { convertsToCollisionBody, getSupportType, isLiquid, type LiquidTypes, matterFillContribution } from '../../../Matter/matter.ts'
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

  fillTile(x: number, y: number, type: MatterType, fill = FILL_MAX, onlyEmpty = false) {
    const width = this.width
    if (x < 0 || x >= width || y < 0 || y >= this.height) return
    const tiles = this.tiles
    const idx = y * width + x
    const raw = tiles[idx]
    if (onlyEmpty) {
      if (matterType(raw) !== EMPTY) return
    } else {
      if (matterType(raw) === MatterType.PERMANENT) return
      if (getSupportType(raw) >= SupportType.STRUCTURAL && getSupportType(type) < SupportType.STRUCTURAL) {
        this.structuralRemovals.push(idx)
      }
    }
    // Read before mutating — matterFillContribution needs the pre-write tile/fill to know what
    // matter (if any) this write is destroying, so the loss (or gain) can be tracked below.
    const before = matterFillContribution(raw, this.fill[idx])
    tiles[idx] = type
    // Liquids track their mass in the parallel `fill` array, not the tile bits. Non-liquid
    // writes must zero it too — otherwise a liquid tile overwritten by e.g. FIRE leaves its old
    // fill behind as a "zombie" value that resurfaces (double-counted) if that cell ever
    // becomes liquid again via depositLiquid, which only adds to whatever fill is already there.
    this.fill[idx] = isLiquid(type) ? fill : 0
    // fillTile is the one place particles mutate tiles/fill directly (no matching tank
    // debit/credit like the brush/beam paths), so it must self-report the resulting
    // matter-conservation delta the same way depositLiquid does.
    const after = matterFillContribution(type, this.fill[idx])
    if (after !== before) this.conservationTracker.addDelta(after - before)
    this.pendingActivations.push(idx)
  }

  fillEmptyTile(x: number, y: number, type: MatterValue, fill = FILL_MAX) {
    this.fillTile(x, y, type, fill, true)
  }

  setTile(idx: number, type: MatterValue) {
    const before = matterFillContribution(this.tiles[idx], this.fill[idx])
    this.tiles[idx] = type
    this.fill[idx] = isLiquid(matterType(type)) ? FILL_MAX : 0
    const after = matterFillContribution(type, this.fill[idx])
    if (after !== before) this.conservationTracker.addDelta(after - before)
    this.pendingActivations.push(idx)
  }

  // Adds a small amount of liquid to a tile — for particles (e.g. water splash droplets)
  // that carry a fixed, conserved fill amount rather than a full tile's worth. Refuses to
  // overwrite a tile occupied by a different matter type (returns 0). Never clamps the
  // result to FILL_MAX — fill legitimately exceeds FILL_MAX elsewhere in this engine
  // (compression, resolved later by doUpwardPressurePass), and clamping here silently
  // destroyed pre-existing compressed mass whenever a droplet landed back on an
  // already-full puddle, which the caller had no way to detect and credit.
  depositLiquid(idx: number, type: MatterValue, amount: number): number {
    // A write to an out-of-range idx silently no-ops on the underlying typed array —
    // returning `amount` unconditionally below would then credit the conservation tracker
    // for a write that never happened. Guard explicitly rather than relying on callers to
    // always pass a valid idx.
    if (idx < 0 || idx >= this.tiles.length) return 0
    const raw = this.tiles[idx]
    const curType = matterType(raw)
    const depositType = matterType(type)
    if (curType !== MatterType.EMPTY && curType !== depositType) return 0
    if (curType === MatterType.EMPTY) this.tiles[idx] = type
    this.fill[idx] += amount
    this.pendingActivations.push(idx)

    if (amount > 0) {
      this.conservationTracker.addDelta(amount)
    }

    return amount
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

  fillCircle(x: number, y: number, radius: number, value: number, fill = FILL_MAX, onlyEmpty = false) {
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
        this.fillTile(px, py, value, fill, onlyEmpty)
      }
    }
  }

  fillEmptyCircle(x: number, y: number, radius: number, value: MatterValue, fill = FILL_MAX) {
    this.fillCircle(x, y, radius, value, fill, true)
  }

  fillLine(x1: number, y1: number, x2: number, y2: number, size: number, value: MatterValue, fill = FILL_MAX, onlyEmpty = false) {
    const radius = Math.max(0.5, size / 2)
    const dx = x2 - x1
    const dy = y2 - y1
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), 1))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      if (size === 1) {
        this.fillTile(Math.floor(x1 + dx * t), Math.floor(y1 + dy * t), value, fill, onlyEmpty)
      } else {
        this.fillCircle(x1 + dx * t, y1 + dy * t, radius, value, fill, onlyEmpty)
      }
    }
  }

  fillEmptyLine(x1: number, y1: number, x2: number, y2: number, size: number, value: MatterValue, fill = FILL_MAX) {
    this.fillLine(x1, y1, x2, y2, size, value, fill, true)
  }

  fillLineExcluding(x1: number, y1: number, x2: number, y2: number, EXCLUDE: MatterTypeSet, value: MatterValue, fill = FILL_MAX) {
    const dx = x2 - x1
    const dy = y2 - y1
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), 1))
    const width = this.width

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = Math.floor(x1 + dx * t)
      const y = Math.floor(y1 + dy * t)
      if (x < 0 || x >= width || y < 0 || y >= this.height) continue
      if (EXCLUDE.has(matterType(this.tiles[y * width + x]))) continue
      this.fillTile(x, y, value, fill)
    }
  }

  // Sweeps from origin (x0, y0) along delta (dx, dy) and returns the tile index of the
  // last tile before the first one a physics body would collide with (see
  // convertsToCollisionBody), or undefined if the whole path is clear.
  // Treats the map edge as a collision boundary — without this, a ray that steps past x/y
  // bounds computed a flat index that either silently no-op'd (mass vanished, "evaporating"
  // splash droplets near corners with nowhere logged to land) or wrapped into an unrelated,
  // valid tile on the next/previous row (droplet visibly landing far from where it left).
  doLiquidCollision(x0: number, y0: number, dx: number, dy: number, type: LiquidTypes, fillUnits: number): boolean {
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.ceil(dist * 2))

    const width = this.width
    const height = this.height
    const tiles = this.tiles

    // Clamp the starting tile into bounds: a particle within [0, width)/[0, height) (i.e.
    // not yet caught by outOfBounds) can still round to an out-of-range row/col when within
    // 0.5 of an edge (e.g. y0 = height - 0.05 rounds to height) — an unclamped prevIdx here
    // returned that invalid index whenever the very next step also landed out of bounds,
    // and the caller had no way to detect the write silently no-op'ing on it.
    const startX = Math.min(width - 1, Math.max(0, Math.round(x0)))
    const startY = Math.min(height - 1, Math.max(0, Math.round(y0)))
    let prevIdx = startY * width + startX

    let prevTypeWasLiquid = matterType(this.tiles[prevIdx]) === type
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const ox = Math.round(x0 + dx * t)
      const oy = Math.round(y0 + dy * t)
      if (ox < 0 || ox >= width || oy < 0 || oy >= height) {
        this.depositLiquid(prevIdx, type, fillUnits)
        return true
      }
      const idx = oy * width + ox
      if (idx === prevIdx) continue
      if (!prevTypeWasLiquid && matterType(tiles[idx]) === type) {
        this.depositLiquid(prevIdx, type, fillUnits)
        return true
      }
      if (convertsToCollisionBody(tiles[idx])) {
        this.depositLiquid(prevIdx, type, fillUnits)
        return true
      }
      prevTypeWasLiquid = matterType(tiles[idx]) === type
      prevIdx = idx
    }

    return false
  }

  doSolidCollision(x0: number, y0: number, dx: number, dy: number): null | number {
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.ceil(dist * 2))

    const width = this.width
    const height = this.height
    const tiles = this.tiles

    // Clamp the starting tile into bounds: a particle within [0, width)/[0, height) (i.e.
    // not yet caught by outOfBounds) can still round to an out-of-range row/col when within
    // 0.5 of an edge (e.g. y0 = height - 0.05 rounds to height) — an unclamped prevIdx here
    // returned that invalid index whenever the very next step also landed out of bounds,
    // and the caller had no way to detect the write silently no-op'ing on it.
    const startX = Math.min(width - 1, Math.max(0, Math.round(x0)))
    const startY = Math.min(height - 1, Math.max(0, Math.round(y0)))
    let prevIdx = startY * width + startX

    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const ox = Math.round(x0 + dx * t)
      const oy = Math.round(y0 + dy * t)
      if (ox < 0 || ox >= width || oy < 0 || oy >= height) {
        return prevIdx
      }
      const idx = oy * width + ox
      if (idx === prevIdx) continue
      if (convertsToCollisionBody(tiles[idx])) {
        return prevIdx
      }
      prevIdx = idx
    }

    return null
  }
}