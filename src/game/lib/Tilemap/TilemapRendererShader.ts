import {
  ACID,
  BURNING_THERMITE,
  C4,
  CHILLED_ICE,
  CONCRETE,
  CRYO,
  EMPTY,
  FALLING_WAX,
  FIRE,
  FUSE,
  GUNPOWDER,
  ICE,
  LAVA,
  METHANE,
  NAPALM,
  NITRO,
  OIL,
  PERMANENT,
  PLANT,
  ROCK,
  SALT,
  SALT_WATER,
  SAND,
  SOLID,
  STEAM,
  THERMITE,
  WATER,
  WAX,
} from '../Matter/_Matter.types.ts'

export function makeTilemapFragShader(
  glowRadius: number,
  glowEnabled: boolean,
  debugSettled: boolean,
  debugAnchored: boolean,
): string {
  const GR = glowRadius
  const GR_LOOP = glowRadius * 2 + 1
  const GR1 = glowRadius + 1  // intensity numerator at d=1

  // language=GLSL
  return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif

      #define GLOW_ENABLED ${glowEnabled ? 1 : 0}
      #define DEBUG_SETTLED ${debugSettled ? 1 : 0}
      #define DEBUG_ANCHORED ${debugAnchored ? 1 : 0}

      uniform sampler2D uTerrain;
      uniform sampler2D uMask;
      uniform sampler2D uEffect;
      uniform sampler2D uParticles;

      uniform float uInnerGlowStrength;
      uniform vec3 uGlowColor;
      uniform vec3 uOutlineColor;
      uniform float uOutlineOpacity;

      uniform vec3 uPermanentTileColor;
      uniform vec3 uSandColor;
      uniform vec3 uSandSettledColor;
      uniform float uSandSettledColorAlpha;
      uniform vec3 uSandSettledOutlineColor;
      uniform vec3 uWaterColor;
      uniform float uWaterAlpha;

      uniform vec3 uFireColor;
      uniform vec3 uOilColor;
      uniform float uOilAlpha;
      uniform vec3 uLavaColor;
      uniform vec3 uRockColor;
      uniform vec3 uSteamColor;
      uniform float uSteamAlpha;
      uniform vec3 uMethaneColor;
      uniform float uMethaneAlpha;
      uniform vec3 uSaltColor;
      uniform vec3 uSaltWaterColor;
      uniform float uSaltWaterAlpha;
      uniform vec3 uConcreteColor;
      uniform vec3 uPlantColor;
      uniform vec3 uFuseColor;
      uniform vec3 uWaxColor;
      uniform vec3 uFallingWaxColor;
      uniform float uFallingWaxAlpha;
      uniform vec3 uNitroColor;
      uniform float uNitroAlpha;
      uniform vec3 uNapalmColor;
      uniform float uNapalmAlpha;
      uniform vec3 uC4Color;
      uniform vec3 uIceColor;
      uniform float uIceAlpha;
      uniform vec3 uChilledIceColor;
      uniform float uChilledIceAlpha;
      uniform vec3 uCryoColor;
      uniform float uCryoAlpha;
      uniform vec3 uAcidColor;
      uniform float uAcidAlpha;
      uniform vec3 uThermiteColor;
      uniform vec3 uBurningThermiteColor;
      uniform vec3 uGunpowderColor;
      uniform vec3 uDrawDebugSettledColor;
      uniform float uDrawDebugSettledAlpha;
      uniform vec3 uDrawDebugAnchoredColor;
      uniform float uDrawDebugAnchoredAlpha;

      uniform float uTime;

      // reciprocal tilemap size: one texel step per tile
      uniform vec2 uInvTilemapSize;

      // phaser framework variable
      varying vec2 outTexCoord;

      float hash(vec2 p) {
          p = fract(p * vec2(0.1031, 0.1030));
          p += dot(p, p + 33.33);
          return fract((p.x + p.y) * p.x);
      }

      // Smooth value noise: bilinear interpolation over 4 hash samples.
      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
      }

      float blendOverlay(float base, float blend) {
          return base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
      }

      vec3 blendOverlay(vec3 base, vec3 blend, float ratio) {
          vec3 blended = vec3(
            blendOverlay(base.r, blend.r),
            blendOverlay(base.g, blend.g),
            blendOverlay(base.b, blend.b)
          );
          return mix(base.rgb, blended, ratio);
      }

      void main() {
          // Normalise time to seconds in a small range to avoid mediump precision loss
          float t = mod(uTime * 0.001, 100.0);
          // Tile-space UV: each unit = one tile. Use this for noise so frequency
          // is expressed in tiles rather than normalised [0,1] UV space.
          vec2 tileUV = outTexCoord / uInvTilemapSize;
          // uMask R = MatterType (0–255), G = SETTLED (0 or 255), B = ANCHORED (0 or 255).
          vec3 mask    = texture2D(uMask, outTexCoord).rgb;
          int tileType = int(mask.r * 255.0 + 0.5);
          bool settled  = mask.g > 0.5;
          bool anchored = mask.b > 0.5;

          // Glow: find the minimum Manhattan distance from this tile to the
          // nearest EMPTY or WATER neighbour within glowRadius.
          // Using loop bounds baked as literals for WebGL 1 compatibility.
          float glow    = 0.0;
          float outline = 0.0;
          #if GLOW_ENABLED
          if (tileType != ${EMPTY}) {
              int minDist = ${GR1};
              for (int i = 0; i < ${GR_LOOP}; i++) {
                  int dy = i - ${GR};
                  for (int j = 0; j < ${GR_LOOP}; j++) {
                      int dx = j - ${GR};
                      if (dx != 0 || dy != 0) {
                          vec2 nUV = outTexCoord + vec2(float(dx), float(dy)) * uInvTilemapSize;
                          int nt = int(texture2D(uMask, nUV).r * 255.0 + 0.5);
                          if (nt == ${EMPTY} || nt == ${WATER}) {
                              int d = (dx >= 0 ? dx : -dx) + (dy >= 0 ? dy : -dy);
                              if (d < minDist) minDist = d;
                          }
                      }
                  }
              }
              if (minDist <= ${GR}) {
                  glow    = float(${GR1} - minDist) / float(${GR});
                  outline = minDist == 1 ? 1.0 : 0.0;
              }
          }
          #endif

          vec4 color;
          // solidGlow: true for powder/structural types that should receive the
          // standard outline + inner-glow treatment after per-type coloring.
          bool solidGlow = false;

          if (tileType == ${PERMANENT}) {
              color = texture2D(uTerrain, outTexCoord);
              color.rgb = blendOverlay(color.rgb, uPermanentTileColor, 0.80);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, uPermanentTileColor, uOutlineOpacity);
              }
          }
          else if (tileType == ${SOLID}) {
              color = texture2D(uTerrain, outTexCoord);
              if (outline > 0.5) {
                  color.rgb = blendOverlay(color.rgb, uOutlineColor, uOutlineOpacity);
                  color.rgb = mix(color.rgb, uOutlineColor, 0.45);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb * uGlowColor, color.rgb, 1.0 - glow * uInnerGlowStrength);
              }
          }
          else if (tileType == ${SAND}) {
              if (settled) {
                  color = texture2D(uTerrain, outTexCoord);
                  color.rgb = mix(color.rgb, uSandSettledColor, uSandSettledColorAlpha);
              } else {
                  color = vec4(uSandColor, 1.0);
              }
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, uSandSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, uGlowColor, glow * uInnerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${WATER}) {
              color = vec4(uWaterColor * uWaterAlpha, uWaterAlpha);
          }
          else if (tileType == ${FIRE}) {
              color = vec4(uFireColor, 1.0);
          }
          else if (tileType == ${OIL}) {
              color = vec4(uOilColor, uOilAlpha);
          }
          else if (tileType == ${LAVA}) {
              float glow2 = noise(tileUV * 0.12 + vec2(t * 1.8, t * 1.1)) * 0.25;
              color = vec4(uLavaColor + vec3(glow2, glow2, 0.0), 1.0);
          }
          else if (tileType == ${ROCK}) {
              color = vec4(uRockColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${STEAM}) {
              color = vec4(uSteamColor, uSteamAlpha);
          }
          else if (tileType == ${METHANE}) {
              color = vec4(uMethaneColor, uMethaneAlpha);
          }
          else if (tileType == ${SALT}) {
              color = vec4(uSaltColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${SALT_WATER}) {
              color = vec4(uSaltWaterColor, uSaltWaterAlpha);
          }
          else if (tileType == ${CONCRETE}) {
              color = vec4(uConcreteColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${PLANT}) {
              color = vec4(uPlantColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${FUSE}) {
              color = vec4(uFuseColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${WAX}) {
              color = vec4(uWaxColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${FALLING_WAX}) {
              color = vec4(uFallingWaxColor, uFallingWaxAlpha);
          }
          else if (tileType == ${NITRO}) {
              color = vec4(uNitroColor, uNitroAlpha);
          }
          else if (tileType == ${NAPALM}) {
              color = vec4(uNapalmColor, uNapalmAlpha);
          }
          else if (tileType == ${C4}) {
              color = vec4(uC4Color, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${ICE}) {
              color = vec4(uIceColor, uIceAlpha);
              solidGlow = true;
          }
          else if (tileType == ${CHILLED_ICE}) {
              color = vec4(uChilledIceColor, uChilledIceAlpha);
              solidGlow = true;
          }
          else if (tileType == ${CRYO}) {
              color = vec4(uCryoColor, uCryoAlpha);
          }
          else if (tileType == ${ACID}) {
              float pulse = noise(tileUV * 0.2 + vec2(t * 2.5, t * 1.4)) * 0.35;
              color = vec4((uAcidColor * uAcidAlpha) + vec3(pulse, 0.0, 0.0), uAcidAlpha);
          }
          else if (tileType == ${THERMITE}) {
              color = vec4(uThermiteColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${BURNING_THERMITE}) {
              float br = noise(tileUV * 0.25 + vec2(t * 5.0, t * 3.1)) * 0.2;
              color = vec4(uBurningThermiteColor + vec3(0.0, br, br), 1.0);
          }
          else if (tileType == ${GUNPOWDER}) {
              color = vec4(uGunpowderColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${EMPTY}) {
              color = vec4(0.0, 0.0, 0.0, 0.0);
          }
          //unknown type — debug magenta
          else {
              color = vec4(1.0, 0.0, 1.0, 1.0);
          }

          if (solidGlow) {
              if (outline > 0.5) {
                  color.rgb = blendOverlay(color.rgb, uOutlineColor, uOutlineOpacity);
                  color.rgb = mix(color.rgb, uOutlineColor, 0.45);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb * uGlowColor, color.rgb, 1.0 - glow * uInnerGlowStrength);
              }
          }

          // uEffect carries timed fire-mode colors. RGB = fire mode color, A = intensity (1→0).
          vec4 eff = texture2D(uEffect, outTexCoord);
          if (eff.a > 0.004) {
              color = mix(color, vec4(eff.rgb, 1.0), eff.a);
          }

          // uParticles: particle pixel layer written each frame by the particle worker.
          // Uploaded via texSubImage2D without UNPACK_FLIP_Y, so row 0 lands at GL bottom.
          // Y-flip corrects world-top=row0 to screen-top.
          vec4 pt = texture2D(uParticles, vec2(outTexCoord.x, 1.0 - outTexCoord.y));
          if (pt.a > 0.004) {
              color = mix(color, vec4(pt.rgb, 1.0), pt.a * 0.5);
          }

          #if DEBUG_SETTLED
            bool isStatic = tileType == ${SOLID} || tileType == ${PERMANENT};
            if ((settled || isStatic) && tileType != ${EMPTY}) {
                color.rgb = mix(color.rgb, uDrawDebugSettledColor, uDrawDebugSettledAlpha);
            }
          #endif

          #if DEBUG_ANCHORED
            if (anchored && tileType != ${EMPTY}) {
                color.rgb = mix(color.rgb, uDrawDebugAnchoredColor, uDrawDebugAnchoredAlpha);
            }
          #endif

          if (color.a < 0.01) discard;
          gl_FragColor = color;
      }
  `
}