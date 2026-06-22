/// <reference lib="webworker" />
import { matterType, MatterType } from '../../../Matter/_Matter.types.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../../../Matter/Tank/_MatterTank.types.ts'
import type { ParticleType } from '../../../Particles/_particle-types.ts'
import type { Particle } from '../../../Particles/Particle.ts'
import { PARTICLE_DEFS } from '../../../Particles/particles.ts'
import { ParticleData, type ParticleDataBuffers } from '../../data/ParticleData.ts'
import { ParticlePool } from './ParticlePool.ts'
import { ParticleWorkerOutMsg } from './ParticleSim.types.ts'

export class ParticleSim {
  tiles!: Uint32Array
  width = 0
  height = 0
  pool!: ParticlePool
  pendingActivations: number[] = []
  data: ParticleData
  private loopRunning = false

  init(tiles: Uint32Array, buffers: ParticleDataBuffers) {
    this.tiles = tiles
    this.width = buffers.width
    this.height = buffers.height
    this.data = new ParticleData(buffers)
    this.pool = new ParticlePool()
  }

  private startLoop() {
    if (this.loopRunning) return
    this.loopRunning = true
    const loop = () => {
      this.step()
      if (this.pool.isEmpty) {
        this.loopRunning = false
      } else {
        setTimeout(loop, 16)
      }
    }
    setTimeout(loop, 16)
  }

  step() {
    this.data.clear()
    this.pendingActivations.length = 0

    this.pool.forEachActive((p) => {
      const def = PARTICLE_DEFS[p.particleType]
      if (!def) {
        this.pool.release(p)
        return
      }
      def.action(p, this)
      p.actionIterations++
    })

    this.data.publish()

    if (this.pendingActivations.length) {
      postMessage({ type: ParticleWorkerOutMsg.ACTIVATIONS, indices: this.pendingActivations.slice() })
    }
  }

  spawn(type: ParticleType, x: number, y: number, ownerId: MatterTankId = NO_MATTER_TANK_ID) {
    const def = PARTICLE_DEFS[type]
    if (!def || !this.pool) return
    for (let i = 0; i < def.particlesToSpawn; i++) {
      const p = this.pool.acquire(type, x, y, ownerId)
      if (!p) break
      def.init(p, this)
    }
    this.startLoop()
  }

  getTileType(x: number, y: number): MatterType {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return MatterType.PERMANENT
    return matterType(this.tiles[y * this.width + x])
  }

  setTileType(x: number, y: number, type: MatterType) {
    const width = this.width
    if (x < 0 || x >= width || y < 0 || y >= this.height) return
    const tiles = this.tiles
    const cur = matterType(tiles[y * width + x])
    if (cur === MatterType.SOLID || cur === MatterType.PERMANENT) return
    tiles[y * width + x] = type
    this.pendingActivations.push(y * width + x)
  }

  destroyTile(x: number, y: number, type: MatterType) {
    const width = this.width
    if (x < 0 || x >= width || y < 0 || y >= this.height) return
    const tiles = this.tiles
    if (matterType(tiles[y * width + x]) === MatterType.PERMANENT) return
    tiles[y * width + x] = type
    this.pendingActivations.push(y * width + x)
  }

  writeTileCircle(cx: number, cy: number, radius: number, type: MatterType) {
    const r = Math.max(1, Math.round(radius))
    const x0 = Math.round(cx)
    const y0 = Math.round(cy)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) this.setTileType(x0 + dx, y0 + dy, type)
      }
    }
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
}
