import type { Particle } from './Particle.ts'

export class ParticlePixelRenderer {
  private readonly buf32: Uint32Array

  constructor(
    readonly width: number,
    readonly height: number,
    readonly buffer: Uint8ClampedArray,
  ) {
    this.buf32 = new Uint32Array(this.buffer.buffer, this.buffer.byteOffset, width * height)
  }

  clear() {
    this.buf32.fill(0)
  }

  drawCircle(x: number, y: number, radius: number, color: number, alpha = 1) {
    const r = Math.max(1, Math.round(radius))
    const cx = Math.round(x)
    const cy = Math.round(y)
    const R = (color >> 16) & 0xFF
    const G = (color >> 8) & 0xFF
    const B = color & 0xFF
    const A = Math.round(alpha * 255)
    const pixel32 = R | (G << 8) | (B << 16) | (A << 24)
    const { buf32, width, height } = this
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const px = cx + dx
        const py = cy + dy
        if (px < 0 || px >= width || py < 0 || py >= height) continue
        buf32[py * width + px] = pixel32
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
