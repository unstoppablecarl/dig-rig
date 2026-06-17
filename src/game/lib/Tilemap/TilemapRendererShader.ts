import { BlendMode } from '../../config/blend-modes.ts'
import type { MatterRenderConfig } from '../../config/colors.ts'
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
  LAVA_DROP,
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
import type { TilemapRendererConfig } from './TilemapRendererConfig.ts'
import Color = Phaser.Display.Color

function v3(c: Color) {
  return `vec3(${c.redGL.toFixed(6)}, ${c.greenGL.toFixed(6)}, ${c.blueGL.toFixed(6)})`
}

function fl(n: number) {
  return Number.isInteger(n) ? `${n}.0` : `${n}`
}

function blendMode(mode: BlendMode) {
  const map: Record<BlendMode, string> = {
    [BlendMode.NONE]: 'mix',
    [BlendMode.OVERLAY]: 'blendOverlay',
    [BlendMode.MULTIPLAY]: 'blendMultiply',
  }
  return map[mode]
}

export function makeTilemapFragShader(
  config: TilemapRendererConfig,
  matterConfig: MatterRenderConfig,
): string {
  const c = config
  const m = matterConfig
  const GR = c.glowRadius
  const GR_LOOP = c.glowRadius * 2 + 1
  const GR1 = c.glowRadius + 1  // intensity numerator at d=1

  // language=GLSL
  return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif

      #define GLOW_ENABLED ${c.glowEnabled ? 1 : 0}
      #define DEBUG_SETTLED ${c.drawDebugSettled ? 1 : 0}
      #define DEBUG_ANCHORED ${c.drawDebugAnchored ? 1 : 0}

      uniform sampler2D uTerrain;
      uniform sampler2D uMask;
      uniform sampler2D uEffect;
      uniform sampler2D uParticles;
      uniform float uTime;
      uniform vec2 uInvTilemapSize;

      const float innerGlowStrength = ${fl(c.glowStrength)};
      vec3 glowColor = ${v3(c.glowColor)};

      // phaser framework variable
      varying vec2 outTexCoord;

      float random(float x) {
          return fract(sin(x * 12.9898) * 43758.5453);
      }

      float hash(vec2 p, float s1, float s2, float s3) {
          p = fract(p * vec2(s1, s2));
          p += dot(p, p + s3);
          return fract((p.x + p.y) * p.x);
      }
      const float HASH_S1_DEFAULT = 0.1031;
      const float HASH_S2_DEFAULT = 0.1030;
      const float HASH_S3_DEFAULT = 33.33;

      float hash(vec2 p, float s1, float s2) {
          return hash(p, s1, s2, HASH_S3_DEFAULT);
      }
      float hash(vec2 p, float s1) {
          return hash(p, s1, HASH_S2_DEFAULT, HASH_S3_DEFAULT);
      }
      float hash(vec2 p) {
          return hash(p, HASH_S1_DEFAULT, HASH_S2_DEFAULT, HASH_S3_DEFAULT);
      }

      float grainHash(vec2 p) {
          return hash(p, 443.897, 441.423, 19.19);
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

      vec3 blendMultiply(vec3 base, vec3 blend, float ratio) {
          vec3 multiplied = base.rgb * blend.rgb;
          return mix(base.rgb, multiplied, ratio);
      }

      bool randomPercent(float chance, float s1, float s2) {
          vec2 tileUV = outTexCoord / uInvTilemapSize;
          return (hash(floor(tileUV + 0.5), s1, s2, 0.3214432) < chance);
      }
      bool randomPercent(float chance, float s1) {
          return randomPercent(chance, s1, 0.1030);
      }

      vec4 sandTexture(vec2 tileUV, vec3 settledColor, vec3 settledColorHighlight){
          float grain = grainHash(floor(tileUV + 0.5));
          vec3 c = clamp(mix(settledColor, settledColorHighlight, grain), 0.0, 1.0);
          vec4 color = vec4(c, 1.0);
          if (randomPercent(0.02, 0.2314, 0.234432)) {
              color.rgb = blendOverlay(color.rgb, vec3(1, 1, 1), 0.9);
          }
          if (randomPercent(0.02, 0.3)) {
              color.rgb = blendMultiply(color.rgb, settledColor.rgb, 0.5);
          }
          return color;
      }

      vec4 liquid(float t, vec3 colorA, vec3 colorB, float alpha){
          const float speed = 1.0;
          const float scale = 100.0;
          vec2 p = outTexCoord * scale;
          p.x += t * speed * 0.15;

          float wt = t * speed;
          float w1 = sin(p.x + wt * 0.5) * cos(p.y - wt * 0.4);
          float w2 = sin((p.x + p.y) * 1.618 - wt * 0.8) * cos((p.x - p.y) * 2.236 + wt * 0.6);
          float w3 = sin(p.x * 3.141 + wt * 1.2) * cos(p.y * 2.718 - wt * 1.1);

          float totalWave = w1 + (w2 * 0.5) + (w3 * 0.25);
          float blend = (totalWave / 1.75) * 0.5 + 0.5;

          return vec4(mix(colorA, colorB, blend), alpha);
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
          if (tileType != ${EMPTY} && (tileType == ${SOLID} || tileType == ${PERMANENT} || settled)) {
              int minDist = ${GR1};
              for (int i = 0; i < ${GR_LOOP}; i++) {
                  int dy = i - ${GR};
                  for (int j = 0; j < ${GR_LOOP}; j++) {
                      int dx = j - ${GR};
                      if (dx != 0 || dy != 0) {
                          vec2 nUV = outTexCoord + vec2(float(dx), float(dy)) * uInvTilemapSize;
                          vec4 n = texture2D(uMask, nUV);
                          int nt = int(n.r * 255.0 + 0.5);
                          bool nSettled = n.g > 0.5;
                          bool nIsSolid = nt == ${SOLID} || nt == ${PERMANENT};
                          if (nt == ${EMPTY} || nt == ${WATER} || (!nSettled && !nIsSolid)) {
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

          if (tileType == ${PERMANENT}) {
              const vec3 permanentColor = ${v3(m[PERMANENT].color)};
              const vec3 outlineColor = ${v3(m[PERMANENT].outlineColor)};
              const float outlineOpacity = ${fl(m[PERMANENT].outlineOpacity)};
              const float strength = ${fl(m[PERMANENT].blendModeStrength)};

              color = texture2D(uTerrain, outTexCoord);
              color.rgb = ${blendMode(m[PERMANENT].blendMode)}(color.rgb, permanentColor, strength);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, outlineColor, outlineOpacity);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb * glowColor, color.rgb, 1.0 - glow * innerGlowStrength);
              }
          }
          else if (tileType == ${SOLID}) {
              const float outlineOpacity = ${fl(m[SOLID].outlineOpacity)};
              const vec3 outlineColor = ${v3(m[SOLID].outlineColor)};
              const float outlineBlendStrength = ${fl(m[SOLID].outlineBlendModeStrength)};

              color = texture2D(uTerrain, outTexCoord);
              if (outline > 0.5) {
                  color.rgb = ${blendMode(m[SOLID].outlineBlendMode)}(color.rgb, outlineColor, outlineBlendStrength);
                  color.rgb = mix(color.rgb, outlineColor, outlineOpacity);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb * glowColor, color.rgb, 1.0 - glow * innerGlowStrength);
              }
          }
          else if (tileType == ${SAND}) {
              const vec3 sandColor = ${v3(m[SAND].color)};
              const vec3 sandSettledColor = ${v3(m[SAND].settledColor)};
              const vec3 sandSettledColorHighlight = ${v3(m[SAND].settledColorHighlight)};
              const vec3 sandSettledOutlineColor = ${v3(m[SAND].settledOutlineColor)};

              glowColor.rgb = sandColor;

              if (settled) {
                  color = sandTexture(tileUV, sandSettledColor, sandSettledColorHighlight);
              } else {
                  color = vec4(sandColor, 1.0);
              }
              if (outline > 0.5) {
                  color.rgb = sandSettledOutlineColor;
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, sandSettledColorHighlight, glow);
              }
          }
          else if (tileType == ${ROCK}) {
              const vec3 rockColor = ${v3(m[ROCK].color)};
              const vec3 rockSettledColor = ${v3(m[ROCK].settledColor)};
              const vec3 rockSettledColorHighlight = ${v3(m[ROCK].rockSettledColorHighlight)};
              const vec3 rockSettledOutlineColor = ${v3(m[ROCK].settledOutlineColor)};

              if (settled) {
                  color = sandTexture(tileUV, rockSettledColor, rockSettledColorHighlight);
              } else {
                  color = vec4(rockColor, 1.0);
              }
              glowColor.rgb = rockColor;

              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, rockSettledOutlineColor, 1.0);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength);
              }
          }
          else if (tileType == ${SALT}) {
              const vec3 saltColor = ${v3(m[SALT].color)};
              const vec3 saltSettledColor = ${v3(m[SALT].settledColor)};
              const vec3 saltSettledColorHighlight = ${v3(m[SALT].rockSettledColorHighlight)};
              const vec3 saltSettledOutlineColor = ${v3(m[SALT].settledOutlineColor)};

              if (settled) {
                  color = sandTexture(tileUV, saltSettledColor, saltSettledColorHighlight);
              } else {
                  color = vec4(saltColor, 1.0);
              }

              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, saltSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${ICE}) {
              const vec3 iceColor = ${v3(m[ICE].color)};
              const vec3 iceSettledColor = ${v3(m[ICE].settledColor)};
              const float iceAlpha = ${fl(m[ICE].alpha)};
              const vec3 iceSettledOutlineColor = ${v3(m[ICE].settledOutlineColor)};

              color = vec4(settled ? iceSettledColor : iceColor, iceAlpha);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, iceSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${CHILLED_ICE}) {
              const vec3 chilledIceColor = ${v3(m[CHILLED_ICE].color)};
              const float chilledIceAlpha = ${fl(m[CHILLED_ICE].alpha)};
              const vec3 chilledIceSettledColor = ${v3(m[CHILLED_ICE].settledColor)};
              const vec3 chilledIceSettledOutlineColor = ${v3(m[CHILLED_ICE].settledOutlineColor)};
              color = vec4(settled ? chilledIceSettledColor : chilledIceColor, chilledIceAlpha);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, chilledIceSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${CONCRETE}) {
              const vec3 concreteColor = ${v3(m[CONCRETE].color)};
              const vec3 concreteSettledColor = ${v3(m[CONCRETE].settledColor)};
              const vec3 concreteSettledOutlineColor = ${v3(m[CONCRETE].settledOutlineColor)};
              color = vec4(settled ? concreteSettledColor : concreteColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, concreteSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${WAX}) {
              const vec3 waxColor = ${v3(m[WAX].color)};
              const vec3 waxSettledColor = ${v3(m[WAX].settledColor)};
              const vec3 waxSettledOutlineColor = ${v3(m[WAX].settledOutlineColor)};
              color = vec4(settled ? waxSettledColor : waxColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, waxSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${FUSE}) {
              const vec3 fuseColor = ${v3(m[FUSE].color)};
              const vec3 fuseSettledColor = ${v3(m[FUSE].settledColor)};
              const vec3 fuseSettledOutlineColor = ${v3(m[FUSE].settledOutlineColor)};
              color = vec4(settled ? fuseSettledColor : fuseColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, fuseSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${GUNPOWDER}) {
              const vec3 gunpowderColor = ${v3(m[GUNPOWDER].color)};
              const vec3 gunpowderSettledColor = ${v3(m[GUNPOWDER].settledColor)};
              const vec3 gunpowderSettledOutlineColor = ${v3(m[GUNPOWDER].settledOutlineColor)};
              color = vec4(settled ? gunpowderSettledColor : gunpowderColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, gunpowderSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${NITRO}) {
              const vec3 nitroColor = ${v3(m[NITRO].color)};
              const float nitroAlpha = ${fl(m[NITRO].alpha)};

              color = vec4(nitroColor, nitroAlpha);
          }
          else if (tileType == ${C4}) {
              const vec3 c4Color = ${v3(m[C4].color)};
              const vec3 c4SettledColor = ${v3(m[C4].settledColor)};
              const vec3 c4SettledOutlineColor = ${v3(m[C4].settledOutlineColor)};
              color = vec4(settled ? c4SettledColor : c4Color, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, c4SettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${THERMITE}) {
              const vec3 thermiteColor = ${v3(m[THERMITE].color)};
              const vec3 thermiteSettledColor = ${v3(m[THERMITE].settledColor)};
              const vec3 thermiteSettledOutlineColor = ${v3(m[THERMITE].settledOutlineColor)};
              color = vec4(settled ? thermiteSettledColor : thermiteColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, thermiteSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          // liquids
          else if (tileType == ${WATER}) {
              const vec3 colorA = ${v3(m[WATER].colorA)};
              const vec3 colorB = ${v3(m[WATER].colorB)};
              const float alpha = ${fl(m[WATER].alpha)};

              color = liquid(t, colorA, colorB, alpha);
          }
          else if (tileType == ${SALT_WATER}) {
              const vec3 colorA = ${v3(m[SALT_WATER].colorA)};
              const vec3 colorB = ${v3(m[SALT_WATER].colorB)};
              const float alpha = ${fl(m[SALT_WATER].alpha)};

              color = liquid(t, colorA, colorB, alpha);
          }
          else if (tileType == ${OIL}) {
              const vec3 colorA = ${v3(m[OIL].colorA)};
              const vec3 colorB = ${v3(m[OIL].colorB)};
              const float alpha = ${fl(m[OIL].alpha)};

              color = liquid(t, colorA, colorB, alpha);
          }
          else if (tileType == ${LAVA}) {
              const vec3 colorA = ${v3(m[LAVA].colorA)};
              const vec3 colorB = ${v3(m[LAVA].colorB)};
              const float alpha = ${fl(m[LAVA].alpha)};

              color = liquid(t, colorA, colorB, alpha);
          }
          else if (tileType == ${LAVA_DROP}) {
              const vec3 dropColor = ${v3(m[LAVA_DROP].color)};
              const float alpha = ${fl(m[LAVA_DROP].alpha)};

              color = vec4(dropColor, alpha);
          }
          else if (tileType == ${NAPALM}) {
              const vec3 colorA = ${v3(m[NAPALM].colorA)};
              const vec3 colorB = ${v3(m[NAPALM].colorB)};
              const float alpha = ${fl(m[NAPALM].alpha)};

              color = liquid(t, colorA, colorB, alpha);
          }
          else if (tileType == ${ACID}) {
              const vec3 colorA = ${v3(m[ACID].colorA)};
              const vec3 colorB = ${v3(m[ACID].colorB)};
              const float alpha = ${fl(m[ACID].alpha)};

              color = liquid(t, colorA, colorB, alpha);
          }
          // gases
          else if (tileType == ${STEAM}) {
              const vec3 steamColor = ${v3(m[STEAM].color)};
              const float alpha = ${fl(m[STEAM].alpha)};

              color = vec4(steamColor, alpha);
          }
          else if (tileType == ${METHANE}) {
              const vec3 methaneColor = ${v3(m[METHANE].color)};
              const float alpha = ${fl(m[METHANE].alpha)};

              color = vec4(methaneColor, alpha);
          }
          // other
          else if (tileType == ${FIRE}) {
              const vec3 fireColor = ${v3(m[FIRE].color)};

              color = vec4(fireColor, 1.0);
          }
          else if (tileType == ${CRYO}) {
              const vec3 cryoColor = ${v3(m[CRYO].color)};
              const float alpha = ${fl(m[CRYO].alpha)};

              color = vec4(cryoColor, alpha);
          }
          else if (tileType == ${PLANT}) {
              const vec3 plantColor = ${v3(m[PLANT].color)};
              const vec3 plantSettledColor = ${v3(m[PLANT].settledColor)};
              const vec3 plantSettledOutlineColor = ${v3(m[PLANT].settledOutlineColor)};

              color = vec4(settled ? plantSettledColor : plantColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, plantSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${FALLING_WAX}) {
              const vec3 fallingWaxColor = ${v3(m[FALLING_WAX].color)};
              const float alpha = ${fl(m[FALLING_WAX].alpha)};

              color = vec4(fallingWaxColor, alpha);
          }
          else if (tileType == ${BURNING_THERMITE}) {
              float br = noise(tileUV * 0.25 + vec2(t * 5.0, t * 3.1)) * 0.2;
              color = vec4(${v3(m[BURNING_THERMITE].color)} + vec3(0.0, br, br), 1.0);
          }
          else if (tileType == ${EMPTY}) {
              color = vec4(0.0, 0.0, 0.0, 0.0);
          }
          //unknown type — debug magenta
          else {
              color = vec4(1.0, 0.0, 1.0, 1.0);
          }

          // uEffect carries timed color transitions. RGB = color, A = intensity (1→0).
          vec4 eff = texture2D(uEffect, outTexCoord);
          if (eff.a > 0.004) {
              float effA = pow(eff.a, 2.0);
              color = mix(color, vec4(eff.rgb, 1.0), effA);
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
              const vec3 drawDebugSettledColor = ${v3(c.drawDebugSettledColor)};
              const float drawDebugSettledAlpha = ${fl(c.drawDebugSettledAlpha)};

              color.rgb = mix(color.rgb, drawDebugSettledColor, drawDebugSettledAlpha);
          }
          #endif

          #if DEBUG_ANCHORED
          if (anchored && tileType != ${EMPTY}) {
              const vec3 drawDebugAnchoredColor = ${v3(c.drawDebugAnchoredColor)};
              const float drawDebugAnchoredAlpha = ${fl(c.drawDebugAnchoredAlpha)};
              color.rgb = mix(color.rgb, drawDebugAnchoredColor, drawDebugAnchoredAlpha);
          }
          #endif

          if (color.a < 0.01) discard;
          gl_FragColor = color;
      }
  `
}
