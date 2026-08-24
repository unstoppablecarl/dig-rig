// Returns color as 0xRRGGBB. makePatternTerrainTexture expects this format.
export type PatternRenderer = {
  (
    // pixel x
    x: number,
    // pixel y
    y: number,
    // chunk x
    cx: number,
    // chunk y
    cy: number,
  ): number,
}