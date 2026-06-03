/// <reference lib="webworker" />
import { MatterType, TYPE_MASK } from '../Matter/_Matter-types.ts'
import type { ParticleWorkerInMessage, ParticleWorkerOutMessage } from './_ParticleWorker-types.ts'
import { ParticleWorkerInMsg, ParticleWorkerOutMsg } from './_ParticleWorker-types.ts'
import type { Particle } from './Particle.ts'
import { ParticlePixelRenderer } from './ParticlePixelRenderer.ts'
import { ParticlePool } from './ParticlePool.ts'
import { PARTICLE_DEFS } from './particles.ts'

declare function postMessage(msg: ParticleWorkerOutMessage): void

let tiles: Uint32Array
let width = 0
let height = 0
let renderer: ParticlePixelRenderer
let pool: ParticlePool
const pendingActivations: number[] = []

function getTileType(x: number, y: number): MatterType {
  if (x < 0 || x >= width || y < 0 || y >= height) return MatterType.PERMANENT
  return (tiles[y * width + x] & TYPE_MASK) as MatterType
}

function setTileType(x: number, y: number, type: MatterType) {
  if (x < 0 || x >= width || y < 0 || y >= height) return
  const cur = tiles[y * width + x] & TYPE_MASK
  if (cur === MatterType.SOLID || cur === MatterType.PERMANENT) return
  tiles[y * width + x] = type
  pendingActivations.push(y * width + x)
}

const context = {
  get width() {
    return width
  },
  get height() {
    return height
  },
  getTileType,
  setTileType,
  writeTileCircle(cx: number, cy: number, radius: number, type: MatterType) {
    const r = Math.max(1, Math.round(radius))
    const x0 = Math.round(cx)
    const y0 = Math.round(cy)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) setTileType(x0 + dx, y0 + dy, type)
      }
    }
  },
  tileAtTip(p: Particle): MatterType {
    const radius = p.size / 2
    const theta = Math.atan2(p.yVelocity, p.xVelocity)
    const tx = Math.round(p.x + Math.cos(theta) * radius)
    const ty = Math.round(p.y + Math.sin(theta) * radius)
    if (tx < 0 || tx >= width || ty < 0 || ty >= height) return MatterType.EMPTY
    return (tiles[ty * width + tx] & TYPE_MASK) as MatterType
  },
  outOfBounds(p: Particle): boolean {
    return p.x < 0 || p.x >= width || p.y < 0 || p.y >= height
  },
}

function step() {
  renderer.clear()
  pendingActivations.length = 0

  pool.forEachActive((p) => {
    const def = PARTICLE_DEFS[p.particleType]
    if (!def) {
      pool.release(p)
      return
    }
    def.action(p, renderer, pool, context)
    p.actionIterations++
  })

  if (pendingActivations.length) {
    postMessage({ type: ParticleWorkerOutMsg.ACTIVATIONS, indices: pendingActivations.slice() })
  }

  setTimeout(step, 16)
}

self.onmessage = (e: MessageEvent<ParticleWorkerInMessage>) => {
  const msg = e.data

  if (msg.type === ParticleWorkerInMsg.INIT) {
    tiles = new Uint32Array(msg.tilesSab)
    width = msg.width
    height = msg.height
    renderer = new ParticlePixelRenderer(width, height, new Uint8ClampedArray(msg.pixelSab))
    pool = new ParticlePool()
    setTimeout(step, 16)
    return
  }

  if (msg.type === ParticleWorkerInMsg.SPAWN) {
    const def = PARTICLE_DEFS[msg.particleType]
    if (!def || !pool) return
    for (let i = 0; i < def.particlesToSpawn; i++) {
      const p = pool.acquire(msg.particleType, msg.x, msg.y)
      if (!p) break
      def.init(p, msg.x, msg.y, context)
    }
  }
}
