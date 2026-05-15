import { GameObjects } from 'phaser'
import { PERMANENT_COLOR, TERRAIN_TYPE_TRANSITION_COLORS } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { TerrainType } from './TileMap.ts'
import { TerrainChunkRenderer } from './TilemapRenderer/TerrainChunkRenderer.ts'
import { TerrainEffectSystem } from './TilemapRenderer/TerrainEffectSystem.ts'
import Shader = GameObjects.Shader
import Texture = Phaser.Textures.Texture

const OUTLINE_OPACITY = 0.5
const GLOW_COLOR = [0, 0, 0]
const GLOW_STRENGTH = 0.5
const toVec3 = (c: number): [number, number, number] => [
  ((c >> 16) & 0xFF) / 255,
  ((c >> 8) & 0xFF) / 255,
  (c & 0xFF) / 255,
]

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
    
    uniform float uOutlineOpacity;
    
    uniform vec3 uDestroyColor;
    uniform vec3 uCreateColor;
    uniform vec3 uPermanentColor;
   
    uniform vec3 uPermanentTileColor;

    // phaser framework variable
    varying vec2 outTexCoord;

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
            // permanent color tinted toward uGlowColor near empty space
            color = vec4(mix(uPermanentTileColor, uGlowColor, glow * uInnerGlowStrength), 1.0);
            // is outline pixel
            if (outline > 0.5) {
                color.rgb = mix(color.rgb, uGlowColor, uOutlineOpacity);
            }
        }
        // SOLID
        else if (mask > 0.25) {
            // SOLID — terrain texture, soft glow gradient, crisp 1px outline on top
            color = texture2D(uTerrain, outTexCoord);
            // is glow pixel
            if (glow > 0.01)   {
                color.rgb = mix(color.rgb, uGlowColor, glow * uInnerGlowStrength);
            }
            // is outline pixel
            if (outline > 0.5) {
                color.rgb = mix(color.rgb, uGlowColor, uOutlineOpacity);
            }
        }
        // EMPTY — fully transparent
        else { 
            color = vec4(0.0, 0.0, 0.0, 0.0);
        }

        // uEffect carries timed transition colors (dig/fill animations).
        // R = intensity fading 1→0 over EFFECT_DURATION_MS.
        // G = color selector: <0.25 → destroy color, <0.75 → create color, else permanent color.
        vec4 eff = texture2D(uEffect, outTexCoord);
        float intensity = eff.r;
        if (intensity > 0.01) {
            float ci = eff.g;
            vec3 effectColor = uPermanentColor;
            if(ci < 0.25){
                effectColor = uDestroyColor;
            } else if(ci < 0.75){
                effectColor = uCreateColor;
            }
            color = mix(color, vec4(effectColor, 1.0), intensity);
        }

        if (color.a < 0.01) discard;
        gl_FragColor = color;
    }
`

export class TilemapRenderer extends SceneBound {
  private chunkRenderer: TerrainChunkRenderer
  private effectSystem: TerrainEffectSystem

  constructor(
    public scene: GameLevel,
    terrainTexture: Texture,
  ) {
    super(scene)

    this.chunkRenderer = new TerrainChunkRenderer(scene)
    this.effectSystem = new TerrainEffectSystem(scene)

    const { width, height } = scene.tilemap

    const shader: Shader = scene.add.shader(
      {
        name: 'TerrainShader',
        fragmentSource: FRAG_SHADER,
        setupUniforms: (setUniform: (name: string, value: any) => void) => {
          setUniform('uTerrain', 0)
          setUniform('uMask',    1)
          setUniform('uGlow',    2)
          setUniform('uEffect',  3)
          setUniform('uGlowColor',        GLOW_COLOR)
          setUniform('uInnerGlowStrength', GLOW_STRENGTH)
          setUniform('uOutlineOpacity',    OUTLINE_OPACITY)
          setUniform('uPermanentTileColor', toVec3(PERMANENT_COLOR))
          setUniform('uDestroyColor',   toVec3(TERRAIN_TYPE_TRANSITION_COLORS[TerrainType.EMPTY] as number))
          setUniform('uCreateColor',    toVec3(TERRAIN_TYPE_TRANSITION_COLORS[TerrainType.SOLID] as number))
          setUniform('uPermanentColor', toVec3(TERRAIN_TYPE_TRANSITION_COLORS[TerrainType.PERMANENT] as number))
        },
      },
      0, 0,
      width, height,
    )
    shader.setOrigin(0, 0)
    // setTextures accepts Texture[] at runtime but the TS type only declares string[]
    shader.setTextures([
      terrainTexture,
      this.chunkRenderer.maskTexture,
      this.chunkRenderer.glowTexture,
      this.effectSystem.effectTexture,
    ] as any)
    scene.layers.terrain.add(shader)

    // Force shader compilation now (during create) to avoid a stall on the first rendered frame.
    // ShaderQuad.run() normally triggers this lazily; calling it here moves the GPU compile cost
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
