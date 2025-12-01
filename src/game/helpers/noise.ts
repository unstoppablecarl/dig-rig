import { createNoise3D } from 'simplex-noise'
import type { Position } from '../types.ts'
import Vector2 = Phaser.Math.Vector2

export function makeSimplexNoise(scale: number, timeScale: number) {
  const noise = createNoise3D()

  return (pos: Position, time: number, result: Vector2) => {
    const nx = pos.x * scale
    const ny = pos.y * scale
    const nt = time * timeScale
    const noiseX = noise(nx, ny, nt)
    // ensures the X and Y forces have different, but still smooth, patterns
    const noiseY = noise(nx + 1000, ny + 1000, nt)

    return result.set(noiseX, noiseY)
  }
}