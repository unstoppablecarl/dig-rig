import type { Particle } from './Particle.ts'

export class ParticlePixelRenderer {
  readonly buffer: Uint8ClampedArray

  constructor(
    readonly width: number,
    readonly height: number,
    buffer?: Uint8ClampedArray,
  ) {
    this.buffer = buffer ?? new Uint8ClampedArray(width * height * 4)
  }

  clear() {
    this.buffer.fill(0)
  }

  drawCircle(x: number, y: number, radius: number, color: number, alpha = 1) {
    const r = Math.max(1, Math.round(radius))
    const cx = Math.round(x)
    const cy = Math.round(y)
    const R = (color >> 16) & 0xFF
    const G = (color >> 8) & 0xFF
    const B = color & 0xFF
    const A = Math.round(alpha * 255)
    const { buffer, width, height } = this
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const px = cx + dx
        const py = cy + dy
        if (px < 0 || px >= width || py < 0 || py >= height) continue
        const i = (py * width + px) * 4
        buffer[i]     = R
        buffer[i + 1] = G
        buffer[i + 2] = B
        buffer[i + 3] = A
      }
    }
  }

  drawCircleFromParticle(p: Particle, radius: number, color: number) {
    this.drawCircle(p.x, p.y, radius, color)
  }

  drawThickLine(x1: number, y1: number, x2: number, y2: number, size: number, color: number) {
    const radius = Math.max(0.5, size / 2)
    const dx = x2 - x1
    const dy = y2 - y1
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), 1))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      this.drawCircle(x1 + dx * t, y1 + dy * t, radius, color)
    }
  }
}
