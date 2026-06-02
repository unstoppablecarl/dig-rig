import { GameObjects } from 'phaser'
import type { Particle } from './Particle.ts'

export class ParticleRenderer {
  constructor(private graphics: GameObjects.Graphics) {}

  clear() {
    this.graphics.clear()
  }

  drawThickLine(x1: number, y1: number, x2: number, y2: number, size: number, color: number) {
    this.graphics.lineStyle(Math.max(1, size), color, 1)
    this.graphics.beginPath()
    this.graphics.moveTo(x1, y1)
    this.graphics.lineTo(x2, y2)
    this.graphics.strokePath()
  }

  drawCircle(x: number, y: number, radius: number, color: number, alpha = 1) {
    this.graphics.fillStyle(color, alpha)
    this.graphics.fillCircle(x, y, Math.max(0.5, radius))
  }

  drawCircleFromParticle(p: Particle, radius: number, color: number) {
    this.drawCircle(p.x, p.y, radius, color)
  }
}
