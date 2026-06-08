import { DRAW_TERRAIN_SETTLED_DEBUG, GLOW_ENABLED } from '../../config'
import { PERMANENT_COLOR_RGB } from '../../config/colors.ts'
import { rgbToVec3 } from '../../helpers/color-converters'
import Color = Phaser.Display.Color

const toVec3 = (c: Color): [number, number, number] => [
  c.redGL,
  c.greenGL,
  c.blueGL,
]

export type TilemapRendererConfig = Readonly<typeof TILEMAP_RENDERER_DEFAULTS>
export const TILEMAP_RENDERER_DEFAULTS = {
  glowRadius: 10,
  glowEnabled: GLOW_ENABLED,
  glowColor: rgbToVec3(`rgb(50, 5, 5)`),
  glowStrength: 0.5,

  outlineColor: rgbToVec3(`rgb(255, 200, 200)`),
  outlineOpacity: 0.75,

  sandColor: rgbToVec3(`rgb(194, 153, 66)`),
  sandSettledColor: rgbToVec3(`rgb(194, 153, 66)`),
  sandSettledColorAlpha: 0.65,
  sandSettledOutlineColor: rgbToVec3(`rgb(230, 199, 115)`),

  waterColor: rgbToVec3(`rgb(51, 140, 235)`),
  waterAlpha: 0.60,

  oilColor: rgbToVec3(`rgb(92, 46, 10)`),
  oilAlpha: 0.95,

  steamColor: rgbToVec3(`rgb(194, 214, 235)`),
  steamAlpha: 0.55,

  methaneColor: rgbToVec3(`rgb(140, 140, 140)`),
  methaneAlpha: 0.70,

  saltWaterColor: rgbToVec3(`rgb(128, 176, 255)`),
  saltWaterAlpha: 0.70,

  fallingWaxColor: rgbToVec3(`rgb(240, 224, 209)`),
  fallingWaxAlpha: 0.85,

  nitroColor: rgbToVec3(`rgb(0, 150, 26)`),
  nitroAlpha: 0.90,

  napalmColor: rgbToVec3(`rgb(219, 128, 69)`),
  napalmAlpha: 0.95,

  iceColor: rgbToVec3(`rgb(161, 232, 255)`),
  iceAlpha: 0.85,

  chilledIceColor: rgbToVec3(`rgb(20, 153, 219)`),
  chilledIceAlpha: 0.90,

  cryoColor: rgbToVec3(`rgb(0, 214, 255)`),
  cryoAlpha: 0.80,

  acidColor: rgbToVec3(`rgb(107, 240, 41)`),
  acidAlpha: 0.90,

  fireColor: rgbToVec3(`rgb(255, 0, 0)`),
  lavaColor: rgbToVec3(`rgb(245, 89, 15)`),
  rockColor: rgbToVec3(`rgb(69, 41, 8)`),
  saltColor: rgbToVec3(`rgb(252, 252, 252)`),
  concreteColor: rgbToVec3(`rgb(181, 181, 181)`),
  plantColor: rgbToVec3(`rgb(13, 179, 26)`),
  fuseColor: rgbToVec3(`rgb(219, 176, 199)`),
  waxColor: rgbToVec3(`rgb(240, 224, 212)`),
  c4Color: rgbToVec3(`rgb(240, 230, 150)`),
  thermiteColor: rgbToVec3(`rgb(194, 140, 69)`),
  burningThermiteColor: rgbToVec3(`rgb(255, 130, 130)`),
  gunpowderColor: rgbToVec3(`rgb(171, 171, 140)`),

  permanentColor: toVec3(PERMANENT_COLOR_RGB),

  drawDebugSettledColor: rgbToVec3(`rgb(255, 0, 150)`),
  drawDebugSettledAlpha: 0.5,
  drawDebugSettled: DRAW_TERRAIN_SETTLED_DEBUG,
}
