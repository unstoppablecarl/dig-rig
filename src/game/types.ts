// numbers must be 0-1
export type RGBShaderColor = [number, number, number];

export interface Position {
  x: number,
  y: number,
}

export interface MatterExchanger {
  matterParticleEmitPosition: (out: Position) => Position,
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