import { TerrainType } from '../TileMap/TileMap.ts'
import { TILE_SIZE } from '../../config.ts'

export class TerrainParticle {
  readonly size: number
  public lifetime: number = 0

  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    readonly terrainType: TerrainType = TerrainType.SOLID,
    readonly radius: number = 1,
    readonly maxLifetimeSeconds = 10,
  ) {
    this.size = (1 + radius * 2) * TILE_SIZE
  }

  lifetimePercent() {
    return this.lifetime / this.maxLifetimeSeconds
  }

  expired() {
    return this.lifetime > this.maxLifetimeSeconds
  }
}