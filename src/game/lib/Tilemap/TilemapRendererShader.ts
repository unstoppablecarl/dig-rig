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
  FIRE_INIT_AGE,
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
  PHYSICS_BODY,
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

// Phaser's default vertex shader uses ES 1.0 syntax (attribute, varying), which is incompatible with an ES 3.0
// fragment shader. This custom vertex shader is otherwise identical in behavior to Phaser's default
export function makeTilemapVertShader(): string {
  // language=GLSL
  return `#version 300 es
  precision highp float;

  uniform mat4 uProjectionMatrix;
  layout(location = 0) in vec2 inPosition;
  layout(location = 1) in vec2 inTexCoord;
  out vec2 outTexCoord;

  void main() {
      gl_Position = uProjectionMatrix * vec4(inPosition, 1.0, 1.0);
      outTexCoord = inTexCoord;
  }
  `
}

export function makeTilemapFragShader(
  config: TilemapRendererConfig,
  matterConfig: MatterRenderConfig,
): string {
  const c = config
  const m = matterConfig
  const GR = c.glowRadius
  const GR1 = c.glowRadius + 1  // intensity numerator at d=1

  // language=GLSL
  return `#version 300 es
  precision highp float;
  precision highp int;
  precision highp usampler2D;

  #define GLOW_ENABLED ${c.glowEnabled ? 1 : 0}
  #define DEBUG_SETTLED ${c.drawDebugSettled ? 1 : 0}
  #define DEBUG_ANCHORED ${c.drawDebugAnchored ? 1 : 0}
  #define ICE_TEXTURE_ENABLED ${c.iceTextureEnabled ? 1 : 0}
  #define DRAW_PHYSICS_BODY_TILES_DEBUG ${c.drawDebugPhysicsBodies ? 1 : 0}
  #define PARTICLE_RENDER_ENABLED ${c.particleRenderEnabled ? 1 : 0}
  #define DEBUG_LIQUID_PRESSURE ${c.debugLiquidPressure ? 1 : 0}

  uniform sampler2D uLiquidDensity;
  uniform sampler2D uTerrainBg;
  uniform usampler2D uMask;
  uniform sampler2D uEffect;
  uniform sampler2D uParticles;
  uniform float uTime;

  const float innerGlowStrength = ${fl(c.glowStrength)};
  vec3 glowColor = ${v3(c.glowColor)};

  in vec2 outTexCoord;
  out lowp vec4 fragColor;

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

  // Maps t in [0,1] to a full rainbow spectrum (red -> violet), spread over hue
  // rather than a single-color gradient, so that small differences in t remain
  // visually distinct even when they land close together.
  vec3 spectrum(float t) {
      float hue = clamp(t, 0.0, 1.0) * 0.85;
      vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(hue + k.xyz) * 6.0 - k.www);
      return clamp(p - k.xxx, 0.0, 1.0);
  }

  bool randomPercent(float chance, float s1, float s2) {
      vec2 tileUV = outTexCoord * vec2(textureSize(uMask, 0));
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

  vec3 iceTexture(vec3 color, vec3 bgColor, vec2 uv, float glow){
      vec2 id = floor(uv);
      float h = hash(id);
      float body = mix(0.0, 1.0, h) * 1.2;
      vec3 col = mix(bgColor, color, body * (glow + 0.2));

      return col;
  }

  void main() {
      // Normalise time to seconds in a small range to avoid mediump precision loss
      float t = mod(uTime * 0.001, 100.0);
      // Integer texel coordinate — exact texelFetch addressing; also used for tileUV noise.
      ivec2 tilemapSize = textureSize(uMask, 0);
      ivec2 tileCoord = ivec2(outTexCoord * vec2(tilemapSize));
      // Tile-space UV: each unit = one tile. Use this for noise so frequency
      // is expressed in tiles rather than normalised [0,1] UV space.
      vec2 tileUV = vec2(tileCoord);

      // uMask R = MatterType (0–255), G = SETTLED (0 or 255), B = ANCHORED (0 or 255), A = per-type data.
      uvec4 mask = texelFetch(uMask, tileCoord, 0);
      int tileType = int(mask.r);
      bool settled  = mask.g != 0u;
      bool anchored = mask.b != 0u;

      // Glow: find the minimum Manhattan distance from this tile to the
      // nearest EMPTY or WATER neighbour within glowRadius.
      float glow    = 0.0;
      float outline = 0.0;
      #if GLOW_ENABLED
      if (tileType != ${EMPTY} && (tileType == ${SOLID} || tileType == ${PERMANENT} || settled)) {
          int minDist = ${GR1};
          for (int dy = -${GR}; dy <= ${GR}; dy++) {
              for (int dx = -${GR}; dx <= ${GR}; dx++) {
                  if (dx == 0 && dy == 0) continue;
                  ivec2 nb = tileCoord + ivec2(dx, dy);
                  if (nb.x >= 0 && nb.x < tilemapSize.x && nb.y >= 0 && nb.y < tilemapSize.y) {
                      uvec4 n = texelFetch(uMask, nb, 0);
                      int nt = int(n.r);
                      bool nSettled = n.g != 0u;
                      bool nIsSolid = nt == ${SOLID} || nt == ${PERMANENT};
                      if (nt == ${EMPTY} || nt == ${WATER} || (!nSettled && !nIsSolid)) {
                          int d = abs(dx) + abs(dy);
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

      switch (tileType) {
          case ${PERMANENT}: {
              const vec3 permanentColor = ${v3(m[PERMANENT].color)};
              const vec3 outlineColor = ${v3(m[PERMANENT].outlineColor)};
              const float outlineOpacity = ${fl(m[PERMANENT].outlineOpacity)};
              const float strength = ${fl(m[PERMANENT].blendModeStrength)};

              color = texture(uTerrainBg, outTexCoord);
              color.rgb = ${blendMode(m[PERMANENT].blendMode)}(color.rgb, permanentColor, strength);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, outlineColor, outlineOpacity);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb * glowColor, color.rgb, 1.0 - glow * innerGlowStrength);
              }
              break;
          }
          case ${SOLID}: {
              const float outlineOpacity = ${fl(m[SOLID].outlineOpacity)};
              const vec3 outlineColor = ${v3(m[SOLID].outlineColor)};
              const float outlineBlendStrength = ${fl(m[SOLID].outlineBlendModeStrength)};

              color = texture(uTerrainBg, outTexCoord);
              if (outline > 0.5) {
                  color.rgb = ${blendMode(m[SOLID].outlineBlendMode)}(color.rgb, outlineColor, outlineBlendStrength);
                  color.rgb = mix(color.rgb, outlineColor, outlineOpacity);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb * glowColor, color.rgb, 1.0 - glow * innerGlowStrength);
              }
              break;
          }
          case ${SAND}: {
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
              break;
          }
          case ${ROCK}: {
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
              break;
          }
          case ${SALT}: {
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
              break;
          }
          case ${ICE}: {
              const vec3 iceColor = ${v3(m[ICE].color)};
              const vec3 settledColor = ${v3(m[ICE].settledColor)};
              const vec3 bgColor = ${v3(m[ICE].bgColor)};
              const vec3 outlineColor = ${v3(m[ICE].outlineColor)};
              const float iceAlpha = ${fl(m[ICE].alpha)};

              if (settled) {
                  #if ICE_TEXTURE_ENABLED
                  color = vec4(iceTexture(settledColor, bgColor, tileUV, glow), iceAlpha);
                  #else
                  color = vec4(settledColor, iceAlpha);
                  #endif
              } else {
                  color = vec4(iceColor, iceAlpha);
              }

              if (outline > 0.5) {
                  color = vec4(outlineColor, iceAlpha);
              }
              break;
          }
          case ${CHILLED_ICE}: {
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
              break;
          }
          case ${CONCRETE}: {
              const vec3 concreteColor = ${v3(m[CONCRETE].color)};
              const vec3 concreteSettledColor = ${v3(m[CONCRETE].settledColor)};
              const vec3 concreteSettledOutlineColor = ${v3(m[CONCRETE].settledOutlineColor)};
              color = vec4(settled ? concreteSettledColor : concreteColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, concreteSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
              break;
          }
          case ${WAX}: {
              const vec3 waxColor = ${v3(m[WAX].color)};
              const vec3 waxSettledColor = ${v3(m[WAX].settledColor)};
              const vec3 waxSettledOutlineColor = ${v3(m[WAX].settledOutlineColor)};
              color = vec4(settled ? waxSettledColor : waxColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, waxSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
              break;
          }
          case ${FUSE}: {
              const vec3 fuseColor = ${v3(m[FUSE].color)};
              const vec3 fuseSettledColor = ${v3(m[FUSE].settledColor)};
              const vec3 fuseSettledOutlineColor = ${v3(m[FUSE].settledOutlineColor)};
              color = vec4(settled ? fuseSettledColor : fuseColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, fuseSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
              break;
          }
          case ${GUNPOWDER}: {
              const vec3 gunpowderColor = ${v3(m[GUNPOWDER].color)};
              const vec3 gunpowderSettledColor = ${v3(m[GUNPOWDER].settledColor)};
              const vec3 gunpowderSettledOutlineColor = ${v3(m[GUNPOWDER].settledOutlineColor)};
              color = vec4(settled ? gunpowderSettledColor : gunpowderColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, gunpowderSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
              break;
          }
          case ${NITRO}: {
              const vec3 nitroColor = ${v3(m[NITRO].color)};
              const float nitroAlpha = ${fl(m[NITRO].alpha)};

              color = vec4(nitroColor, nitroAlpha);
              break;
          }
          case ${C4}: {
              const vec3 c4Color = ${v3(m[C4].color)};
              const vec3 c4SettledColor = ${v3(m[C4].settledColor)};
              const vec3 c4SettledOutlineColor = ${v3(m[C4].settledOutlineColor)};
              color = vec4(settled ? c4SettledColor : c4Color, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, c4SettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
              break;
          }
          case ${THERMITE}: {
              const vec3 thermiteColor = ${v3(m[THERMITE].color)};
              const vec3 thermiteSettledColor = ${v3(m[THERMITE].settledColor)};
              const vec3 thermiteSettledOutlineColor = ${v3(m[THERMITE].settledOutlineColor)};
              color = vec4(settled ? thermiteSettledColor : thermiteColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, thermiteSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
              break;
          }
          // liquids
          case ${WATER}: {
              const vec3 colorA = ${v3(m[WATER].colorA)};
              const vec3 colorB = ${v3(m[WATER].colorB)};
              const float alpha = ${fl(m[WATER].alpha)};

              #if DEBUG_LIQUID_PRESSURE
              color = vec4(colorA, alpha);
              #else
              color = liquid(t, colorA, colorB, alpha);
              #endif

              break;
          }
          case ${SALT_WATER}: {
              const vec3 colorA = ${v3(m[SALT_WATER].colorA)};
              const vec3 colorB = ${v3(m[SALT_WATER].colorB)};
              const float alpha = ${fl(m[SALT_WATER].alpha)};

              #if DEBUG_LIQUID_PRESSURE
              color = vec4(colorA, alpha);
              #else
              color = liquid(t, colorA, colorB, alpha);
              #endif

              break;
          }
          case ${OIL}: {
              const vec3 colorA = ${v3(m[OIL].colorA)};
              const vec3 colorB = ${v3(m[OIL].colorB)};
              const float alpha = ${fl(m[OIL].alpha)};

              #if DEBUG_LIQUID_PRESSURE
              color = vec4(colorA, alpha);
              #else
              color = liquid(t, colorA, colorB, alpha);
              #endif

              break;
          }
          case ${LAVA}: {
              const vec3 colorA = ${v3(m[LAVA].colorA)};
              const vec3 colorB = ${v3(m[LAVA].colorB)};
              const float alpha = ${fl(m[LAVA].alpha)};

              #if DEBUG_LIQUID_PRESSURE
              color = vec4(colorA, alpha);
              #else
              color = liquid(t, colorA, colorB, alpha);
              #endif

              break;
          }
          case ${LAVA_DROP}: {
              const vec3 dropColor = ${v3(m[LAVA_DROP].color)};
              const float alpha = ${fl(m[LAVA_DROP].alpha)};

              color = vec4(dropColor, alpha);
              break;
          }
          case ${NAPALM}: {
              const vec3 colorA = ${v3(m[NAPALM].colorA)};
              const vec3 colorB = ${v3(m[NAPALM].colorB)};
              const float alpha = ${fl(m[NAPALM].alpha)};

              #if DEBUG_LIQUID_PRESSURE
              color = vec4(colorA, alpha);
              #else
              color = liquid(t, colorA, colorB, alpha);
              #endif

              break;
          }
          case ${ACID}: {
              const vec3 colorA = ${v3(m[ACID].colorA)};
              const vec3 colorB = ${v3(m[ACID].colorB)};
              const float alpha = ${fl(m[ACID].alpha)};

              #if DEBUG_LIQUID_PRESSURE
              color = vec4(colorA, alpha);
              #else
              color = liquid(t, colorA, colorB, alpha);
              #endif

              break;
          }
          // gases
          case ${STEAM}: {
              const vec3 steamColor = ${v3(m[STEAM].color)};
              const float alpha = ${fl(m[STEAM].alpha)};

              color = vec4(steamColor, alpha);
              break;
          }
          case ${METHANE}: {
              const vec3 methaneColor = ${v3(m[METHANE].color)};
              const float alpha = ${fl(m[METHANE].alpha)};

              color = vec4(methaneColor, alpha);
              break;
          }
          // other
          case ${FIRE}: {
                  // mask.a encodes the age counter (0–${FIRE_INIT_AGE}); 0 = freshly placed (one frame only).
              float ageNorm = clamp(float(mask.a) / ${fl(FIRE_INIT_AGE)}, 0.0, 1.0);

              const vec3 youngColor = ${v3(m[FIRE].youngColor)};
              const vec3 midColor   = ${v3(m[FIRE].midColor)};
              const vec3 oldColor   = ${v3(m[FIRE].oldColor)};

              vec3 fireColor = ageNorm > 0.5
              ? mix(midColor, youngColor, (ageNorm - 0.5) * 2.0)
              : mix(oldColor, midColor, ageNorm * 2.0);

              float flicker = noise(tileUV * 0.5 + vec2(0.0, t * 10.0)) * 0.12 - 0.04;
              color = vec4(clamp(fireColor, 0.0, 1.0), 1.0);
              break;
          }
          case ${CRYO}: {
              const vec3 cryoColor = ${v3(m[CRYO].color)};
              const float alpha = ${fl(m[CRYO].alpha)};

              color = vec4(cryoColor, alpha);
              break;
          }
          case ${PLANT}: {
              const vec3 plantColor = ${v3(m[PLANT].color)};
              const vec3 plantSettledColor = ${v3(m[PLANT].settledColor)};
              const vec3 plantSettledOutlineColor = ${v3(m[PLANT].settledOutlineColor)};

              color = vec4(settled ? plantSettledColor : plantColor, 1.0);
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, plantSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, glowColor, glow * innerGlowStrength * 0.4);
              }
              break;
          }
          case ${FALLING_WAX}: {
              const vec3 fallingWaxColor = ${v3(m[FALLING_WAX].color)};
              const float alpha = ${fl(m[FALLING_WAX].alpha)};

              color = vec4(fallingWaxColor, alpha);
              break;
          }
          case ${BURNING_THERMITE}: {
              float br = noise(tileUV * 0.25 + vec2(t * 5.0, t * 3.1)) * 0.2;
              color = vec4(${v3(m[BURNING_THERMITE].color)} + vec3(0.0, br, br), 1.0);
              break;
          }
          case ${EMPTY}:
          break;
          case ${PHYSICS_BODY}:
          #if DRAW_PHYSICS_BODY_TILES_DEBUG
          color = vec4(1.0, 0.0, 1.0, 1.0);
          #endif
          break;
          default :
          color = vec4(1.0, 0.0, 1.0, 1.0);
          break;
      }

      #if DEBUG_LIQUID_PRESSURE
      if (tileType == ${WATER} || tileType == ${SALT_WATER} || tileType == ${OIL} ||
      tileType == ${LAVA} || tileType == ${NAPALM} || tileType == ${ACID}) {
          float density = texture(uLiquidDensity, outTexCoord).r;
          color.rgb = mix(color.rgb, spectrum(density), 0.85);
      }
      #endif

      // uEffect carries timed color transitions. RGB = color, A = intensity (1→0).
      vec4 eff = texture(uEffect, outTexCoord);
      if (eff.a > 0.004) {
          float effA = pow(eff.a, 2.0);
          color = mix(color, vec4(eff.rgb, 1.0), effA);
      }
      #if PARTICLE_RENDER_ENABLED
      vec4 pt = texture(uParticles, outTexCoord);

      if (pt.a > 0.004) {
          color = mix(color, vec4(pt.rgb, 1.0), pt.a);
      }
      # endif

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
      fragColor = color;
  }
  `
}
