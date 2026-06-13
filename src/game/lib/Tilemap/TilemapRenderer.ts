import { GameObjects } from 'phaser'
import { FIRE_MODE_COLORS } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { MatterType } from '../Matter/_Matter.types.ts'
import { FireMode } from '../Player/_FireMode-types'
import { TerrainChunkRenderer } from './TilemapRenderer/TerrainChunkRenderer.ts'
import { TerrainEffectSystem } from './TilemapRenderer/TerrainEffectSystem.ts'
import { TILEMAP_RENDERER_DEFAULTS, type TilemapRendererConfig } from './TilemapRendererConfig'
import Shader = GameObjects.Shader
import Color = Phaser.Display.Color
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import WebGLTextureWrapper = Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper
import CanvasTexture = Phaser.Textures.CanvasTexture

function buildFragShader(
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
          // solidGlow: true for powder/structural types that should receive the
          // standard outline + inner-glow treatment after per-type coloring.
          bool solidGlow = false;

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
              } else {
                  color = vec4(uSandColor, 1.0);
              }
              if (outline > 0.5) {
                  color.rgb = mix(color.rgb, uSandSettledOutlineColor, 0.5);
              } else if (glow > 0.01) {
                  color.rgb = mix(color.rgb, uGlowColor, glow * uInnerGlowStrength * 0.4);
              }
          }
          else if (tileType == ${MatterType.WATER}) {
              color = vec4(uWaterColor * uWaterAlpha, uWaterAlpha);
          }
          else if (tileType == ${MatterType.FIRE}) {
              color = vec4(uFireColor, 1.0);
          }
          else if (tileType == ${MatterType.OIL}) {
              color = vec4(uOilColor, uOilAlpha);
          }
          else if (tileType == ${MatterType.LAVA}) {
              float glow2 = noise(tileUV * 0.12 + vec2(t * 1.8, t * 1.1)) * 0.25;
              color = vec4(uLavaColor + vec3(glow2, glow2, 0.0), 1.0);
          }
          else if (tileType == ${MatterType.ROCK}) {
              color = vec4(uRockColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.STEAM}) {
              color = vec4(uSteamColor, uSteamAlpha);
          }
          else if (tileType == ${MatterType.METHANE}) {
              color = vec4(uMethaneColor, uMethaneAlpha);
          }
          else if (tileType == ${MatterType.SALT}) {
              color = vec4(uSaltColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.SALT_WATER}) {
              color = vec4(uSaltWaterColor, uSaltWaterAlpha);
          }
          else if (tileType == ${MatterType.CONCRETE}) {
              color = vec4(uConcreteColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.PLANT}) {
              color = vec4(uPlantColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.FUSE}) {
              color = vec4(uFuseColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.WAX}) {
              color = vec4(uWaxColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.FALLING_WAX}) {
              color = vec4(uFallingWaxColor, uFallingWaxAlpha);
          }
          else if (tileType == ${MatterType.NITRO}) {
              color = vec4(uNitroColor, uNitroAlpha);
          }
          else if (tileType == ${MatterType.NAPALM}) {
              color = vec4(uNapalmColor, uNapalmAlpha);
          }
          else if (tileType == ${MatterType.C4}) {
              color = vec4(uC4Color, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.ICE}) {
              color = vec4(uIceColor, uIceAlpha);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.CHILLED_ICE}) {
              color = vec4(uChilledIceColor, uChilledIceAlpha);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.CRYO}) {
              color = vec4(uCryoColor, uCryoAlpha);
          }
          else if (tileType == ${MatterType.ACID}) {
              float pulse = noise(tileUV * 0.2 + vec2(t * 2.5, t * 1.4)) * 0.15;
              color = vec4(uAcidColor + vec3(pulse, 0.0, 0.0), uAcidAlpha);
          }
          else if (tileType == ${MatterType.THERMITE}) {
              color = vec4(uThermiteColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.BURNING_THERMITE}) {
              float br = noise(tileUV * 0.25 + vec2(t * 5.0, t * 3.1)) * 0.2;
              color = vec4(uBurningThermiteColor + vec3(0.0, br, br), 1.0);
          }
          else if (tileType == ${MatterType.GUNPOWDER}) {
              color = vec4(uGunpowderColor, 1.0);
              solidGlow = true;
          }
          else if (tileType == ${MatterType.EMPTY}) {
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
          bool isStatic = tileType == ${MatterType.SOLID} || tileType == ${MatterType.PERMANENT};
          if ((settled || isStatic) && tileType != ${MatterType.EMPTY}) {
              color.rgb = mix(color.rgb, uDrawDebugSettledColor, uDrawDebugSettledAlpha);
          }
          #endif

          #if DEBUG_ANCHORED
          if (anchored && tileType != ${MatterType.EMPTY}) {
              color.rgb = mix(color.rgb, uDrawDebugAnchoredColor, uDrawDebugAnchoredAlpha);
          }
          #endif

          if (color.a < 0.01) discard;
          gl_FragColor = color;
      }
  `
}

export class TilemapRenderer extends SceneBound {
  private readonly chunkRenderer: TerrainChunkRenderer
  private readonly effectSystem: TerrainEffectSystem
  private readonly particleTexture: Phaser.Textures.Texture
  private readonly particleWrapper: WebGLTextureWrapper

  constructor(
    public scene: GameLevel,
    readonly terrainTexture: CanvasTexture,
    config: Partial<TilemapRendererConfig> = {},
  ) {
    super(scene)

    const cfg = {
      ...TILEMAP_RENDERER_DEFAULTS,
      ...config,
    }

    const { width, height } = scene.tilemap

    this.chunkRenderer = new TerrainChunkRenderer(scene)
    this.effectSystem = new TerrainEffectSystem(scene)

    const [particleTexture, particleWrapper] = scene.initGLTexture('particle-pixels', width, height)
    this.particleTexture = particleTexture
    this.particleWrapper = particleWrapper

    const shader: Shader = scene.add.shader(
      {
        name: 'TerrainShader',
        fragmentSource: buildFragShader(cfg.glowRadius, cfg.glowEnabled, cfg.drawDebugSettled, cfg.drawDebugAnchored),
        setupUniforms: (setUniform: (name: string, value: any) => void) => {
          setUniform('uTerrain', 0)
          setUniform('uMask', 1)
          setUniform('uEffect', 2)
          setUniform('uParticles', 3)
          setUniform('uGlowColor', cfg.glowColor)
          setUniform('uOutlineColor', cfg.outlineColor)
          setUniform('uInnerGlowStrength', cfg.glowStrength)
          setUniform('uOutlineOpacity', cfg.outlineOpacity)
          setUniform('uPermanentTileColor', cfg.permanentColor)
          setUniform('uSandColor', cfg.sandColor)
          setUniform('uSandSettledColor', cfg.sandSettledColor)
          setUniform('uSandSettledColorAlpha', cfg.sandSettledColorAlpha)
          setUniform('uSandSettledOutlineColor', cfg.sandSettledOutlineColor)
          setUniform('uWaterColor', cfg.waterColor)
          setUniform('uWaterAlpha', cfg.waterAlpha)
          setUniform('uFireColor', cfg.fireColor)
          setUniform('uOilColor', cfg.oilColor)
          setUniform('uOilAlpha', cfg.oilAlpha)
          setUniform('uLavaColor', cfg.lavaColor)
          setUniform('uRockColor', cfg.rockColor)
          setUniform('uSteamColor', cfg.steamColor)
          setUniform('uSteamAlpha', cfg.steamAlpha)
          setUniform('uMethaneColor', cfg.methaneColor)
          setUniform('uMethaneAlpha', cfg.methaneAlpha)
          setUniform('uSaltColor', cfg.saltColor)
          setUniform('uSaltWaterColor', cfg.saltWaterColor)
          setUniform('uSaltWaterAlpha', cfg.saltWaterAlpha)
          setUniform('uConcreteColor', cfg.concreteColor)
          setUniform('uPlantColor', cfg.plantColor)
          setUniform('uFuseColor', cfg.fuseColor)
          setUniform('uWaxColor', cfg.waxColor)
          setUniform('uFallingWaxColor', cfg.fallingWaxColor)
          setUniform('uFallingWaxAlpha', cfg.fallingWaxAlpha)
          setUniform('uNitroColor', cfg.nitroColor)
          setUniform('uNitroAlpha', cfg.nitroAlpha)
          setUniform('uNapalmColor', cfg.napalmColor)
          setUniform('uNapalmAlpha', cfg.napalmAlpha)
          setUniform('uC4Color', cfg.c4Color)
          setUniform('uIceColor', cfg.iceColor)
          setUniform('uIceAlpha', cfg.iceAlpha)
          setUniform('uChilledIceColor', cfg.chilledIceColor)
          setUniform('uChilledIceAlpha', cfg.chilledIceAlpha)
          setUniform('uCryoColor', cfg.cryoColor)
          setUniform('uCryoAlpha', cfg.cryoAlpha)
          setUniform('uAcidColor', cfg.acidColor)
          setUniform('uAcidAlpha', cfg.acidAlpha)
          setUniform('uThermiteColor', cfg.thermiteColor)
          setUniform('uBurningThermiteColor', cfg.burningThermiteColor)
          setUniform('uGunpowderColor', cfg.gunpowderColor)
          setUniform('uDrawDebugSettledColor', cfg.drawDebugSettledColor)
          setUniform('uDrawDebugSettledAlpha', cfg.drawDebugSettledAlpha)
          setUniform('uDrawDebugAnchoredColor', cfg.drawDebugAnchoredColor)
          setUniform('uDrawDebugAnchoredAlpha', cfg.drawDebugAnchoredAlpha)
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

  addFireModeEffect(tx: number, ty: number, mode: FireMode, startTime?: number) {
    const color = FIRE_MODE_COLORS[mode]
    this.effectSystem.addEffect(tx, ty, color, startTime)
  }

  addColorEffect(tx: number, ty: number, color: Color, startTime?: number) {
    this.effectSystem.addEffect(tx, ty, color, startTime)
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
