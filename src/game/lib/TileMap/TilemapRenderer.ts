import { GameObjects } from 'phaser'
import { TERRAIN_TYPE_TRANSITION_COLORS } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { TerrainType } from './TileMap.ts'
import { TerrainChunkRenderer } from './TilemapRenderer/TerrainChunkRenderer.ts'
import { TerrainEffectSystem } from './TilemapRenderer/TerrainEffectSystem.ts'
import Shader = GameObjects.Shader
import Texture = Phaser.Textures.Texture

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
uniform vec3 uGlowColor;
uniform float uInnerGlowStrength;
uniform vec3 uDestroyColor;
uniform vec3 uCreateColor;
uniform vec3 uPermanentColor;

varying vec2 outTexCoord;

void main() {
  float mask = texture2D(uMask, outTexCoord).r;
  float glow = texture2D(uGlow, outTexCoord).g;
  vec4 color;

  if (mask > 0.75) {
    color = vec4(mix(vec3(0.0, 1.0, 1.0), uGlowColor, glow * uInnerGlowStrength), 1.0);
  } else if (mask > 0.25) {
    color = texture2D(uTerrain, outTexCoord);
    if (glow > 0.01) {
      color.rgb = mix(color.rgb, uGlowColor, glow * uInnerGlowStrength);
    }
  } else {
    color = vec4(0.0, 0.0, 0.0, 0.0);
  }

  vec4 eff = texture2D(uEffect, outTexCoord);
  float ei = eff.r;
  if (ei > 0.01) {
    float ci = eff.g;
    vec3 ec = ci < 0.25 ? uDestroyColor : (ci < 0.75 ? uCreateColor : uPermanentColor);
    color = mix(color, vec4(ec, 1.0), ei);
  }

  if (color.a < 0.01) discard;
  gl_FragColor = color;
}
`

export class TilemapRenderer extends SceneBound {
  private chunkRenderer: TerrainChunkRenderer
  private effectSystem: TerrainEffectSystem
  private destroyed = false

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
          setUniform('uGlowColor',        [0, 0, 0])
          setUniform('uInnerGlowStrength', 0.5)
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

  destroy() {
    this.destroyed = true
    this.chunkRenderer.destroy()
    this.effectSystem.destroy()
    super.destroy()
  }
}
