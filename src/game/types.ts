export interface Position {
  x: number,
  y: number,
}

export interface MatterExchanger {
  matterParticleEmitPosition: () => Position,
  matterParticleCollectPosition: () => Position,
}

export interface ParticleTarget {
  maxVelocity: number,
  x: number,
  y: number,
  prevPosition: {
    x: number,
    y: number,
  }
}