const RADIUS_DECAY = 0.9
export const tilesToRadius = (tiles: number) => Math.sqrt(tiles / Math.PI) * RADIUS_DECAY
export const radiusToTiles = (radius: number) => Math.floor(Math.PI * Math.pow(radius / RADIUS_DECAY, 2))