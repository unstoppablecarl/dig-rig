import type { ParticleTypeName } from '../Matter/_MatterWorker-types.ts'
import type { Particle } from './Particle.ts'
import type { ParticlePool } from './ParticlePool.ts'
import type { ParticleRenderer } from './ParticleRenderer.ts'

const TWO_PI = Math.PI * 2
const HALF_PI = Math.PI / 2
const QUARTER_PI = Math.PI / 4

// 0xRRGGBB color constants matching the GLSL element colors
const FIRE_COLOR = 0xFF4F0D
const LAVA_COLOR = 0xF55A0F

export type ParticleAction = (
  p: Particle,
  renderer: ParticleRenderer,
  pool: ParticlePool,
) => void

export type ParticleInit = (
  p: Particle,
  spawnX: number,
  spawnY: number,
) => void

export type ParticleDef = { init: ParticleInit; action: ParticleAction }

function rand() {
  return Math.random()
}

const gunpowderExplosion: ParticleDef = {
  init(p) {
    p.color = FIRE_COLOR
    const velocity = 5 + rand() * 10
    const angle = rand() * TWO_PI
    p.setVelocity(velocity, angle)
    p.size = 2 + rand() * 7
  },
  action(p, renderer, pool) {
    const x2 = p.x + p.xVelocity
    const y2 = p.y + p.yVelocity
    renderer.drawThickLine(p.x, p.y, x2, y2, p.size, p.color)
    p.x = x2
    p.y = y2
    if (p.actionIterations % 5 === 0) p.size /= 1.3
    if (p.actionIterations % 15 === 0) p.yVelocity += 10 * (p.actionIterations / 5)
    if (p.size < 1.75) pool.release(p)
  },
}

const nitroExplosion: ParticleDef = {
  init(p) {
    p.color = FIRE_COLOR
    const velocity = 8 + rand() * 14
    p.setVelocity(velocity, rand() * TWO_PI)
    p.size = 3 + rand() * 9
  },
  action(p, renderer, pool) {
    const x2 = p.x + p.xVelocity
    const y2 = p.y + p.yVelocity
    renderer.drawThickLine(p.x, p.y, x2, y2, p.size, p.color)
    p.x = x2
    p.y = y2
    if (p.actionIterations % 4 === 0) p.size /= 1.35
    p.yVelocity += 0.5
    if (p.size < 1.5) pool.release(p)
  },
}

const napalmExplosion: ParticleDef = {
  init(p) {
    p.color = FIRE_COLOR
    p.size = rand() * 8 + 6
    p.xVelocity = rand() * 8 - 4
    p.yVelocity = -(rand() * 4 + 4)
    p.data.maxIter = Math.floor(rand() * 10) + 5
  },
  action(p, renderer, pool) {
    renderer.drawCircleFromParticle(p, p.size, p.color)
    p.x += p.xVelocity
    p.y += p.yVelocity
    p.size *= 1 + rand() * 0.1
    if (p.actionIterations > p.data.maxIter) pool.release(p)
  },
}

const c4Explosion: ParticleDef = {
  init(p) {
    p.color = FIRE_COLOR
    const r = rand() * 10000
    if (r < 9000) p.size = rand() * 10 + 3
    else if (r < 9500) p.size = rand() * 32 + 3
    else if (r < 9800) p.size = rand() * 64 + 3
    else p.size = rand() * 128 + 3
  },
  action(p, renderer, pool) {
    renderer.drawCircleFromParticle(p, p.size, p.color)
    if (p.actionIterations % 3 === 0) {
      p.size /= 3
      if (p.size <= 1) pool.release(p)
    }
  },
}

const methaneExplosion: ParticleDef = {
  init(p) {
    p.color = FIRE_COLOR
    p.size = 10 + rand() * 10
  },
  action(p, renderer, pool) {
    renderer.drawCircleFromParticle(p, p.size, p.color)
    if (p.actionIterations > 2) pool.release(p)
  },
}

const chargedNitro: ParticleDef = {
  init(p, x, y) {
    p.color = FIRE_COLOR
    p.size = 4
    p.xVelocity = 0
    p.yVelocity = -100
    p.data.initX = x
    p.data.initY = y
    p.data.minY = Math.max(0, y - 80 - rand() * 40)
  },
  action(p, renderer, pool) {
    const x2 = p.data.initX
    const y2 = Math.max(p.data.minY, p.y + p.yVelocity)
    renderer.drawThickLine(x2, p.data.initY, x2, y2, p.size, p.color)
    p.y = y2
    if (p.y <= p.data.minY) pool.release(p)
  },
}

const lavaBurst: ParticleDef = {
  init(p, _x, y) {
    p.color = LAVA_COLOR
    let angle = QUARTER_PI + rand() * HALF_PI
    p.xVelocity = (1 + rand() * 3) * Math.cos(angle)
    p.yVelocity = (-4 * rand() - 3) * Math.sin(angle)
    p.data.initY = y
    p.data.initYVelocity = p.yVelocity
    p.data.yAcceleration = 0.06
    p.size = 4 + rand() * 3
    p.y -= p.size
  },
  action(p, renderer, pool) {
    const x2 = p.x + p.xVelocity
    const y2 = p.data.initY
      + p.data.initYVelocity * p.actionIterations
      + (p.data.yAcceleration * p.actionIterations * p.actionIterations) / 2
    renderer.drawThickLine(p.x, p.y, x2, y2, p.size, p.color)
    p.x = x2
    p.y = y2
    if (p.actionIterations % 5 === 0) p.size *= 0.9
    if (p.size < 1 || p.x < 0 || p.y > 9999) pool.release(p)
  },
}

export const PARTICLE_DEFS: Record<ParticleTypeName, ParticleDef> = {
  gunpowder_explosion: gunpowderExplosion,
  nitro_explosion: nitroExplosion,
  napalm_explosion: napalmExplosion,
  c4_explosion: c4Explosion,
  methane_explosion: methaneExplosion,
  charged_nitro: chargedNitro,
  lava_burst: lavaBurst,
}
