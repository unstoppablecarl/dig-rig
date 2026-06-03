import { GameObjects } from 'phaser'
import { GLOW_ENABLED } from '../../config.ts'
import { CREATE_COLOR, DESTROY_COLOR, PERMANENT_COLOR } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { RGBShaderColor } from '../../types.ts'
import { FireMode } from '../Player/_FireMode-types'
import { MatterType } from '../Matter/_Matter-types.ts'
import { TerrainChunkRenderer } from './TilemapRenderer/TerrainChunkRenderer.ts'
import { TerrainEffectSystem } from './TilemapRenderer/TerrainEffectSystem.ts'
import Shader = GameObjects.Shader
import CanvasTexture = Phaser.Textures.CanvasTexture
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import WebGLTextureWrapper = Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper


const toVec3 = (c: number): [number, number, number] => [
  ((c >> 16) & 0xFF) / 255,
  ((c >> 8) & 0xFF) / 255,
  (c & 0xFF) / 255,
]

export type TilemapRendererConfig = {
  readonly outlineColor: RGBShaderColor,
  readonly outlineOpacity: number,
  readonly glowColor: RGBShaderColor,
  readonly glowStrength: number,
  readonly glowRadius: number,
  readonly glowEnabled: boolean,
  readonly sandColor: RGBShaderColor,
  readonly sandSettledColor: RGBShaderColor,
  readonly sandSettledColorAlpha: number
  readonly sandSettledOutlineColor: RGBShaderColor,
  readonly waterColor: RGBShaderColor,
  readonly waterAlpha: number,
}

const CONFIG_DEFAULTS: TilemapRendererConfig = {
  glowRadius: 10,
  glowEnabled: GLOW_ENABLED,
  glowColor: [60, 5, 5].map((v: number) => v / 255) as RGBShaderColor,
  glowStrength: 0.5,

  outlineColor: [255, 200, 200].map((v: number) => v / 255) as RGBShaderColor,
  outlineOpacity: 0.75,
  sandColor:  [0.76, 0.60, 0.26] as RGBShaderColor,
  sandSettledColor: [0.76, 0.60, 0.26] as RGBShaderColor,
  sandSettledColorAlpha: 0.65,
  sandSettledOutlineColor: [0.90, 0.78, 0.45] as RGBShaderColor,
  waterColor: [0.20, 0.55, 0.92] as RGBShaderColor,
  waterAlpha: 0.60,
}

// Glow is computed inline in the fragment shader by sampling the mask texture
// in a glowRadius neighbourhood. Both constants are baked as GLSL literals so
// the compiler can unroll or optimise the fixed-bound loop.
function buildFragShader(glowRadius: number, glowEnabled: boolean): string {
  const GR      = glowRadius
  const GR_LOOP = glowRadius * 2 + 1
  const GR1     = glowRadius + 1  // intensity numerator at d=1

  // language=GLSL
  return `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    #define GLOW_ENABLED ${glowEnabled ? 1 : 0}

    uniform sampler2D uTerrain;
    uniform sampler2D uMask;
    uniform sampler2D uEffect;
    uniform sampler2D uParticles;

    uniform float uInnerGlowStrength;
    uniform vec3 uGlowColor;
    uniform vec3 uOutlineColor;
    uniform float uOutlineOpacity;

    uniform vec3 uDestroyColor;
    uniform vec3 uCreateColor;

    uniform vec3 uPermanentTileColor;
    uniform vec3 uSandColor;
    uniform vec3 uSandSettledColor;
    uniform float uSandSettledColorAlpha;
    uniform vec3 uSandSettledOutlineColor;
    uniform vec3 uWaterColor;
    uniform float uWaterAlpha;
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
    // Eliminates the banding that raw hash produces per texel.
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
        // uMask R = MatterType (0–255), G = SETTLED (0 or 255).
        vec2 mask    = texture2D(uMask, outTexCoord).rg;
        int tileType = int(mask.r * 255.0 + 0.5);
        bool settled = mask.g > 0.5;

        // Glow: find the minimum Manhattan distance from this tile to the
        // nearest EMPTY or WATER neighbour within glowRadius.
        // Using loop bounds baked as literals for WebGL 1 compatibility.
        float glow    = 0.0;
        float outline = 0.0;
        #if GLOW_ENABLED
        if (tileType != ${MatterType.EMPTY}) {
            int minDist = ${GR1};
            for (int i = 0; i < ${GR_LOOP}; i++) {
                int dy = i - ${GR};
                for (int j = 0; j < ${GR_LOOP}; j++) {
                    int dx = j - ${GR};
                    if (dx != 0 || dy != 0) {
                        vec2 nUV = outTexCoord + vec2(float(dx), float(dy)) * uInvTilemapSize;
                        int nt = int(texture2D(uMask, nUV).r * 255.0 + 0.5);
                        if (nt == ${MatterType.EMPTY} || nt == ${MatterType.WATER}) {
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

        if (tileType == ${MatterType.PERMANENT}) {
            color = texture2D(uTerrain, outTexCoord);
            color.rgb = blendOverlay(color.rgb, uPermanentTileColor, 0.80);
            if (outline > 0.5) {
                color.rgb = mix(color.rgb, uPermanentTileColor, uOutlineOpacity);
            }
        }
        else if (tileType == ${MatterType.SOLID}) {
            color = texture2D(uTerrain, outTexCoord);
            if (outline > 0.5) {
                color.rgb = blendOverlay(color.rgb, uOutlineColor, uOutlineOpacity);
                color.rgb = mix(color.rgb, uOutlineColor, 0.45);
            } else if (glow > 0.01) {
                color.rgb = mix(color.rgb * uGlowColor, color.rgb, 1.0 - glow * uInnerGlowStrength);
            }
        }
        else if (tileType == ${MatterType.SAND}) {
            if (settled) {
                color = texture2D(uTerrain, outTexCoord);
                color.rgb = mix(color.rgb, uSandSettledColor, uSandSettledColorAlpha);
                if (outline > 0.5) {
                    color.rgb = mix(color.rgb, uSandSettledOutlineColor, 0.5);
                } else if (glow > 0.01) {
                    color.rgb = mix(color.rgb, uGlowColor, glow * uInnerGlowStrength * 0.4);
                }
            } else {
                color = vec4(uSandColor, 1.0);
            }
        }
        else if (tileType == ${MatterType.WATER}) {
            color = vec4(uWaterColor * uWaterAlpha, uWaterAlpha);
        }
        // ── New element types ────────────────────────────────────────────────
        else if (tileType == ${MatterType.FIRE}) {
            float flicker = noise(tileUV * 0.3 + vec2(t * 4.0, t * 2.3)) * 0.3;
            color = vec4(1.0, 0.3 + flicker, 0.05, 1.0);
        }
        else if (tileType == ${MatterType.OIL}) {
            color = vec4(0.36, 0.18, 0.04, 0.95);
        }
        else if (tileType == ${MatterType.LAVA}) {
            float glow2 = noise(tileUV * 0.12 + vec2(t * 1.8, t * 1.1)) * 0.25;
            color = vec4(0.96 + glow2, 0.35 + glow2, 0.06, 1.0);
        }
        else if (tileType == ${MatterType.ROCK}) {
            color = vec4(0.27, 0.16, 0.03, 1.0);
        }
        else if (tileType == ${MatterType.STEAM}) {
            color = vec4(0.76, 0.84, 0.92, 0.55);
        }
        else if (tileType == ${MatterType.METHANE}) {
            color = vec4(0.55, 0.55, 0.55, 0.70);
        }
        else if (tileType == ${MatterType.SALT}) {
            color = vec4(0.99, 0.99, 0.99, 1.0);
        }
        else if (tileType == ${MatterType.SALT_WATER}) {
            color = vec4(0.50, 0.69, 1.00, 0.70);
        }
        else if (tileType == ${MatterType.CONCRETE}) {
            color = vec4(0.71, 0.71, 0.71, 1.0);
        }
        else if (tileType == ${MatterType.PLANT}) {
            color = vec4(0.05, 0.70, 0.10, 1.0);
        }
        else if (tileType == ${MatterType.FUSE}) {
            color = vec4(0.86, 0.69, 0.78, 1.0);
        }
        else if (tileType == ${MatterType.WAX}) {
            color = vec4(0.94, 0.88, 0.83, 1.0);
        }
        else if (tileType == ${MatterType.FALLING_WAX}) {
            color = vec4(0.94, 0.88, 0.82, 0.85);
        }
        else if (tileType == ${MatterType.NITRO}) {
            color = vec4(0.0, 0.59, 0.10, 0.90);
        }
        else if (tileType == ${MatterType.NAPALM}) {
            color = vec4(0.86, 0.50, 0.27, 0.95);
        }
        else if (tileType == ${MatterType.C4}) {
            color = vec4(0.94, 0.90, 0.59, 1.0);
        }
        else if (tileType == ${MatterType.ICE}) {
            color = vec4(0.63, 0.91, 1.00, 0.85);
        }
        else if (tileType == ${MatterType.CHILLED_ICE}) {
            color = vec4(0.08, 0.60, 0.86, 0.90);
        }
        else if (tileType == ${MatterType.CRYO}) {
            color = vec4(0.0, 0.84, 1.00, 0.80);
        }
        else if (tileType == ${MatterType.ACID}) {
            float pulse = noise(tileUV * 0.2 + vec2(t * 2.5, t * 1.4)) * 0.15;
            color = vec4(0.42 + pulse, 0.94, 0.16, 0.90);
        }
        else if (tileType == ${MatterType.THERMITE}) {
            color = vec4(0.76, 0.55, 0.27, 1.0);
        }
        else if (tileType == ${MatterType.BURNING_THERMITE}) {
            float br = noise(tileUV * 0.25 + vec2(t * 5.0, t * 3.1)) * 0.2;
            color = vec4(1.0, 0.51 + br, 0.51 + br, 1.0);
        }
        else if (tileType == ${MatterType.GUNPOWDER}) {
            color = vec4(0.67, 0.67, 0.55, 1.0);
        }
        // EMPTY (0) — fully transparent; unknown type — debug magenta
        else if (tileType == ${MatterType.EMPTY}) {
            color = vec4(0.0, 0.0, 0.0, 0.0);
        }
        else {
            color = vec4(1.0, 0.0, 1.0, 1.0);
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
            color = mix(color, vec4(pt.rgb, 1.0), pt.a);
        }

        if (color.a < 0.01) discard;
        gl_FragColor = color;
    }
  `
}

export class TilemapRenderer extends SceneBound implements TilemapRendererConfig {
  private readonly chunkRenderer: TerrainChunkRenderer
  private readonly effectSystem: TerrainEffectSystem
  private readonly particleTexture: Phaser.Textures.Texture
  private readonly particleWrapper: WebGLTextureWrapper

  readonly glowRadius = CONFIG_DEFAULTS.glowRadius
  readonly glowEnabled = CONFIG_DEFAULTS.glowEnabled
  readonly glowColor = CONFIG_DEFAULTS.glowColor
  readonly glowStrength = CONFIG_DEFAULTS.glowStrength
  readonly outlineColor = CONFIG_DEFAULTS.outlineColor
  readonly outlineOpacity = CONFIG_DEFAULTS.outlineOpacity
  readonly sandColor = CONFIG_DEFAULTS.sandColor
  readonly sandSettledColor = CONFIG_DEFAULTS.sandSettledColor
  readonly sandSettledColorAlpha = CONFIG_DEFAULTS.sandSettledColorAlpha
  readonly sandSettledOutlineColor = CONFIG_DEFAULTS.sandSettledOutlineColor
  readonly waterColor = CONFIG_DEFAULTS.waterColor
  readonly waterAlpha = CONFIG_DEFAULTS.waterAlpha

  constructor(
    public scene: GameLevel,
    readonly terrainTexture: CanvasTexture,
    config: Partial<TilemapRendererConfig> = {},
  ) {
    super(scene)

    Object.assign(this, config)

    const { width, height } = scene.tilemap

    this.chunkRenderer = new TerrainChunkRenderer(scene)
    this.effectSystem = new TerrainEffectSystem(scene)

    const [particleTexture, particleWrapper] = scene.initGLTexture('particle-pixels', width, height)
    this.particleTexture = particleTexture
    this.particleWrapper = particleWrapper

    const shader: Shader = scene.add.shader(
      {
        name: 'TerrainShader',
        fragmentSource: buildFragShader(this.glowRadius, this.glowEnabled),
        setupUniforms: (setUniform: (name: string, value: any) => void) => {
          setUniform('uTerrain', 0)
          setUniform('uMask', 1)
          setUniform('uEffect', 2)
          setUniform('uParticles', 3)
          setUniform('uGlowColor', this.glowColor)
          setUniform('uOutlineColor', this.outlineColor)
          setUniform('uInnerGlowStrength', this.glowStrength)
          setUniform('uOutlineOpacity', this.outlineOpacity)
          setUniform('uPermanentTileColor', toVec3(PERMANENT_COLOR))
          setUniform('uDestroyColor', toVec3(DESTROY_COLOR as number))
          setUniform('uCreateColor', toVec3(CREATE_COLOR as number))
          setUniform('uSandColor', this.sandColor)
          setUniform('uSandSettledColor', this.sandSettledColor)
          setUniform('uSandSettledColorAlpha', this.sandSettledColorAlpha)
          setUniform('uSandSettledOutlineColor', this.sandSettledOutlineColor)
          setUniform('uWaterColor', this.waterColor)
          setUniform('uWaterAlpha', this.waterAlpha)
          setUniform('uTime', scene.time.now)
          setUniform('uInvTilemapSize', [1.0 / width, 1.0 / height])
        },
      },
      0, 0,
      width, height,
    )

    shader.setOrigin(0, 0)
    shader.setTextures([
      terrainTexture,
      this.chunkRenderer.maskTexture,
      this.effectSystem.effectTexture,
      this.particleTexture,
    ])
    scene.layers.terrain.add(shader)

    // Force shader compilation now (during create) to avoid a stall on the first rendered frame.
    ;(shader as any).renderNode?.programManager?.getCurrentProgramSuite?.()
  }

  updateParticlePixels(buf: Uint8Array) {
    const { width, height } = this.scene.tilemap
    const gl = (this.scene.renderer as WebGLRenderer).gl
    gl.bindTexture(gl.TEXTURE_2D, this.particleWrapper.webGLTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  addEffect(tx: number, ty: number, mode: FireMode, startTime?: number) {
    this.effectSystem.addEffect(tx, ty, mode, startTime)
  }

  render() {
    if (this.destroyed) return

    const chunkManager = this.scene.tilemap.chunkManager

    for (let cy = 0; cy < chunkManager.height; cy++) {
      for (let cx = 0; cx < chunkManager.width; cx++) {
        const chunk = chunkManager.getChunk(cx, cy)
        if (!chunk?.renderDirty) continue
        this.chunkRenderer.renderChunk(chunk)
        chunk.renderDirty = false
      }
    }

    this.effectSystem.update()
  }

  protected onDestroy() {
    this.chunkRenderer.destroy()
    this.effectSystem.destroy()
  }
}
