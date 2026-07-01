import type { Particle } from '../../Particles/Particle.ts'

export type ParticlesBuffers = {
  pixelsA: SharedArrayBuffer
  pixelsB: SharedArrayBuffer
  pendingSlot: SharedArrayBuffer
  width: number
  height: number
}

// only used for transporting draw data for particles
export class ParticleData {
  private readonly viewA: Uint8ClampedArray
  private readonly viewB: Uint8ClampedArray
  private readonly buf32A: Uint32Array
  private readonly buf32B: Uint32Array
  private readonly _pending: Int32Array
  private readonly localBuf: Uint8Array
  private writeSlot = 0

  readonly width: number
  readonly height: number

  static makeBuffers(width: number, height: number): ParticlesBuffers {
    const size = width * height * 4
    return {
      pixelsA: new SharedArrayBuffer(size),
      pixelsB: new SharedArrayBuffer(size),
      pendingSlot: new SharedArrayBuffer(4),
      width,
      height,
    }
  }

  constructor(readonly buffers: ParticlesBuffers) {
    this.width = buffers.width
    this.height = buffers.height
    this.viewA = new Uint8ClampedArray(buffers.pixelsA)
    this.viewB = new Uint8ClampedArray(buffers.pixelsB)
    this.buf32A = new Uint32Array(buffers.pixelsA)
    this.buf32B = new Uint32Array(buffers.pixelsB)
    this._pending = new Int32Array(buffers.pendingSlot)
    Atomics.store(this._pending, 0, -1)
    this.localBuf = new Uint8Array(buffers.pixelsA.byteLength)
  }

  clear() {
    const buf32 = this.writeSlot === 0 ? this.buf32A : this.buf32B
    buf32.fill(0)
  }

  drawCircle(x: number, y: number, radius: number, color: number) {
    const r = Math.max(1, Math.round(radius))
    const cx = Math.round(x)
    const cy = Math.round(y)
    const buf32 = this.writeSlot === 0 ? this.buf32A : this.buf32B
    const { width, height } = this
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const px = cx + dx
        const py = cy + dy
        if (px < 0 || px >= width || py < 0 || py >= height) continue
        buf32[py * width + px] = color
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

  drawTile(tx: number, ty: number, color: number) {
    const x = Math.round(tx)
    const y = Math.round(ty)
    const buf32 = this.writeSlot === 0 ? this.buf32A : this.buf32B
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return
    buf32[y * this.width + x] = color
  }

  publish() {
    Atomics.store(this._pending, 0, this.writeSlot)
    this.writeSlot ^= 1
  }

  // Atomically claims the latest published frame and copies it to a local buffer.
  // Safe: after publish(), the worker writes to the other slot until the next publish,
  // so the claimed slot is never touched while the copy runs.
  consumePixels(): Uint8Array | null {
    const slot = Atomics.exchange(this._pending, 0, -1)
    if (slot === -1) return null
    this.localBuf.set(slot === 0 ? this.viewA : this.viewB)
    return this.localBuf
  }
}
