import { MatterType, TYPE_MASK } from '../Matter/_Matter-types.ts'
import type { Tilemap } from '../Tilemap/Tilemap.ts'
import type { Particle } from './Particle.ts'

export type ParticleContext = ReturnType<typeof makeParticleContext>

export function makeParticleContext(tilemap: Tilemap, pendingActivations: number[]) {

  function getTileType(x: number, y: number) {
    return tilemap.getTile(x, y) & TYPE_MASK as MatterType
  }

  function setTileType(x: number, y: number, type: MatterType) {
    if (x < 0 || x >= tilemap.width || y < 0 || y >= tilemap.height) return
    const cur = tilemap.getTile(x, y) & TYPE_MASK
    if (cur === MatterType.SOLID || cur === MatterType.PERMANENT) return
    tilemap.setTile(x, y, type)
    pendingActivations.push(y * tilemap.width + x)
  }

  function writeTileCircle(cx: number, cy: number, radius: number, type: MatterType) {
    const r = Math.max(1, Math.round(radius))
    const x0 = Math.round(cx)
    const y0 = Math.round(cy)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          setTileType(x0 + dx, y0 + dy, type)
        }
      }
    }
  }

  function tileAtTip(p: Particle): MatterType {
    const radius = p.size / 2
    const theta = Math.atan2(p.yVelocity, p.xVelocity)
    const tx = Math.round(p.x + Math.cos(theta) * radius)
    const ty = Math.round(p.y + Math.sin(theta) * radius)
    return getTileType(tx, ty)
  }

  function outOfBounds(p: Particle): boolean {
    return tilemap.outOfBounds(p.x, p.y)
  }

  return {
    getTileType,
    setTileType,
    writeTileCircle,
    tileAtTip,
    outOfBounds,
  }
}