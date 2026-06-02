import { FireMode } from '../Player/_FireMode-types'

export class VFXTerrainParticle {
  public lifetime: number = 0

  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    readonly mode: FireMode.CREATE | FireMode.DESTROY = FireMode.CREATE,
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