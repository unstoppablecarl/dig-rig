import { GameObjects } from 'phaser'
import {
  CREATE_COLOR,
  DESTROY_COLOR,
  GLOW_ENABLED,
  GLOW_TRANSITION_ANIMATION_ENABLED,
  PERMANENT_COLOR,
} from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { RGBShaderColor } from '../../types.ts'
import { TerrainType } from './_Tilemap-types.ts'
import { TerrainChunkGlowRenderer } from './TilemapRenderer/TerrainChunkGlowRenderer.ts'
import { TerrainChunkRenderer } from './TilemapRenderer/TerrainChunkRenderer.ts'
import { TerrainEffectSystem } from './TilemapRenderer/TerrainEffectSystem.ts'
import Shader = GameObjects.Shader
import CanvasTexture = Phaser.Textures.CanvasTexture

const toVec3 = (c: number): [number, number, number] => [
  ((c >> 16) & 0xFF) / 255,
  ((c >> 8) & 0xFF) / 255,
  (c & 0xFF) / 255,
]

export type TilemapRendererConfig = {
  readonly outlineColor: RGBShaderColor,
  // 0-1
  readonly outlineOpacity: number,
  readonly glowColor: RGBShaderColor,
  // 0-1
  readonly glowStrength: number,
  readonly glowRadius: number,
  readonly glowEnabled: boolean,
  readonly glowTransitionAnimation: boolean,
  readonly glowTransitionMS: number,
}

const CONFIG_DEFAULTS: TilemapRendererConfig = {
  glowRadius: 10,
  glowEnabled: GLOW_ENABLED,
  glowTransitionAnimation: GLOW_TRANSITION_ANIMATION_ENABLED,
  glowTransitionMS: 400,
  glowColor: [60, 5, 5].map((v: number) => v / 255) as RGBShaderColor,
  glowStrength: 0.5,

  outlineColor: [255, 200, 200].map((v: number) => v / 255) as RGBShaderColor,
  outlineOpacity: 0.75,
}

// language=GLSL
const FRAG_SHADER = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform sampler2D uTerrain;
    uniform sampler2D uMask;
    uniform sampler2D uGlow;
    uniform sampler2D uEffect;

    uniform float uInnerGlowStrength;
    uniform vec3 uGlowColor;
    uniform vec3 uOutlineColor;

    uniform float uOutlineOpacity;

    uniform vec3 uDestroyColor;
    uniform vec3 uCreateColor;

    uniform vec3 uPermanentTileColor;

    // phaser framework variable
    varying vec2 outTexCoord;

    float blendOverlay(float base, float blend) {
        return base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
    }

    vec3 blendOverlay(vec3 base, vec3 blend, float ratio) {
        vec3 blended =  vec3(
            blendOverlay(base.r, blend.r),
            blendOverlay(base.g, blend.g),
            blendOverlay(base.b, blend.b)
        );

       
        blended.rgb = mix(base.rgb, blended, ratio);
        
        return blended;
    }
    
    void main() {
        // uMask encodes tile type in the R channel:
        //   R ≈ 0.00  →  EMPTY      (transparent, discarded)
        //   R ≈ 0.50  →  SOLID      (samples terrain texture)
        //   R = 1.00  →  PERMANENT  (fixed cyan base color)
        float mask = texture2D(uMask, outTexCoord).r;

        // uGlow is written by the CPU distance-transform each time terrain changes:
        //   G = gradient intensity 0→1, where 1 is the immediate border and it fades
        //       to 0 at GLOW_RADIUS tiles depth — drives the soft inner glow
        //   R = 1px outline flag: 1.0 only on border tiles (distance == 1), else 0
        vec4 glowTex = texture2D(uGlow, outTexCoord);
        float glow = glowTex.g;
        float outline = glowTex.r;

        vec4 color;

        // PERMANENT
        if (mask > 0.75) {
            color = texture2D(uTerrain, outTexCoord);
            // permanent color tinted toward uGlowColor near empty space
            color.rgb = blendOverlay(color.rgb, uPermanentTileColor, 0.80);
            // is outline pixel
            if (outline > 0.5) {
                color.rgb = mix(color.rgb, uPermanentTileColor, uOutlineOpacity);
            }
        }
        // SOLID
        else if (mask > 0.25) {
            // SOLID — terrain texture, soft glow gradient, crisp 1px outline on top
            color = texture2D(uTerrain, outTexCoord);

            // is outline pixel
            if (outline > 0.5) {
                color.rgb = blendOverlay(color.rgb, uOutlineColor, uOutlineOpacity);
                color.rgb = mix(color.rgb, uOutlineColor, 0.45);
            }

            // is glow pixel
            else if (glow > 0.01)   {
                vec3 multiplyColor = color.rgb * uGlowColor;

                color.rgb = mix(color.rgb, multiplyColor, glow * uInnerGlowStrength);
            }

        }
        // EMPTY — fully transparent
        else {
            color = vec4(0.0, 0.0, 0.0, 0.0);
        }

        // uEffect carries timed transition colors (dig/fill animations).
        // R = destroy (EMPTY) intensity, G = create (SOLID) intensity, both fade 1→0.
        // Both channels can be non-zero on the same tile simultaneously.
        // Weighted average of the active colors, then mix into terrain by total intensity,
        // so each effect contributes proportionally rather than the last one dominating.
        vec4 eff = texture2D(uEffect, outTexCoord);
        float totalI = eff.r + eff.g;
        if (totalI > 0.01) {
            vec3 effectColor = (uDestroyColor * eff.r + uCreateColor * eff.g) / totalI;
            color = mix(color, vec4(effectColor, 1.0), min(totalI, 1.0));
        }

        if (color.a < 0.01) discard;
        gl_FragColor = color;
    }
`

export class TilemapRenderer extends SceneBound implements TilemapRendererConfig {
  private readonly chunkRenderer: TerrainChunkRenderer
  private readonly effectSystem: TerrainEffectSystem
  private readonly glowRenderer: TerrainChunkGlowRenderer

  readonly glowRadius = CONFIG_DEFAULTS.glowRadius
  readonly glowEnabled = CONFIG_DEFAULTS.glowEnabled
  readonly glowTransitionAnimation = CONFIG_DEFAULTS.glowTransitionAnimation
  readonly glowTransitionMS = CONFIG_DEFAULTS.glowTransitionMS
  readonly glowColor = CONFIG_DEFAULTS.glowColor
  readonly glowStrength = CONFIG_DEFAULTS.glowStrength
  readonly outlineColor = CONFIG_DEFAULTS.outlineColor
  readonly outlineOpacity = CONFIG_DEFAULTS.outlineOpacity
  readonly permanentOutlineMask: CanvasTexture

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
    this.permanentOutlineMask = this.scene.initCanvasTexture('permanent_outline', width, height)

    this.glowRenderer = new TerrainChunkGlowRenderer(scene, {
      glowRadius: this.glowRadius,
      glowEnabled: this.glowEnabled,
      glowTransitionAnimation: this.glowTransitionAnimation,
      glowTransitionMS: this.glowTransitionMS,
    })



    const shader: Shader = scene.add.shader(
      {
        name: 'TerrainShader',
        fragmentSource: FRAG_SHADER,
        setupUniforms: (setUniform: (name: string, value: any) => void) => {
          setUniform('uTerrain', 0)
          setUniform('uMask', 1)
          setUniform('uGlow', 2)
          setUniform('uEffect', 3)
          setUniform('uGlowColor', this.glowColor)
          setUniform('uOutlineColor', this.outlineColor)
          setUniform('uInnerGlowStrength', this.glowStrength)
          setUniform('uOutlineOpacity', this.outlineOpacity)
          setUniform('uPermanentTileColor', toVec3(PERMANENT_COLOR))
          setUniform('uDestroyColor', toVec3(DESTROY_COLOR as number))
          setUniform('uCreateColor', toVec3(CREATE_COLOR as number))
        },
      },
      0, 0,
      width, height,
    )

    shader.setOrigin(0, 0)
    shader.setTextures([
      terrainTexture,
      this.chunkRenderer.maskTexture,
      this.glowRenderer.glowTexture,
      this.effectSystem.effectTexture,
    ])
    scene.layers.terrain.add(shader)

    // Force shader compilation now (during create) to avoid a stall on the first rendered frame.
    // ShaderQuad.run() normally triggers this lazily; calling it here moves the GPU compile
    // to scene setup
    ;(shader as any).renderNode?.programManager?.getCurrentProgramSuite?.()
  }

  addEffect(tx: number, ty: number, value: TerrainType, startTime?: number) {
    this.effectSystem.addEffect(tx, ty, value, startTime)
  }

  render() {
    if (this.destroyed) return

    const chunkManager = this.scene.tilemap.chunkManager

    for (let cy = 0; cy < chunkManager.height; cy++) {
      for (let cx = 0; cx < chunkManager.width; cx++) {
        const chunk = chunkManager.getChunk(cx, cy)
        if (!chunk?.renderDirty) continue
        this.chunkRenderer.renderChunk(chunk)
        this.glowRenderer.renderChunk(chunk)
        chunk.renderDirty = false
      }
    }

    this.glowRenderer.updateTransitions()
    this.effectSystem.update()
  }

  protected onDestroy() {
    this.chunkRenderer.destroy()
    this.effectSystem.destroy()
    this.glowRenderer.destroy()
  }
}
