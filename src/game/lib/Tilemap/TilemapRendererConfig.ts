import { DRAW_ANCHORED_DEBUG, DRAW_TERRAIN_SETTLED_DEBUG, GLOW_ENABLED, ICE_TEXTURE_ENABLED } from '../../config'
import { DEBUG_ANCHORED_COLOR, DEBUG_SETTLED_COLOR, EDGE_GLOW_COLOR } from '../../config/colors.ts'

export type TilemapRendererConfig = Readonly<typeof TILEMAP_RENDERER_DEFAULTS>
export const TILEMAP_RENDERER_DEFAULTS = {
  iceTextureEnabled: ICE_TEXTURE_ENABLED,

  glowEnabled: GLOW_ENABLED,
  glowRadius: 10,
  glowColor: EDGE_GLOW_COLOR,
  glowStrength: 0.5,

  drawDebugSettledColor: DEBUG_SETTLED_COLOR,
  drawDebugSettledAlpha: 0.5,
  drawDebugSettled: DRAW_TERRAIN_SETTLED_DEBUG,

  drawDebugAnchoredColor: DEBUG_ANCHORED_COLOR,
  drawDebugAnchoredAlpha: 0.5,
  drawDebugAnchored: DRAW_ANCHORED_DEBUG,
}

