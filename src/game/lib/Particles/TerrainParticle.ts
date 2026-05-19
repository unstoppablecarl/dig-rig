import { TerrainType } from '../Tilemap/Tilemap.ts'

export class TerrainParticle {
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
  }

  lifetimePercent() {
    return this.lifetime / this.maxLifetimeSeconds
  }

  expired() {
    return this.lifetime > this.maxLifetimeSeconds
  }
}