import { GameObjects } from 'phaser'
import { MATTER_RENDER_CONFIG_DEFAULTS, type MatterRenderConfig } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { LiquidDensityRenderer } from './TilemapRenderer/LiquidDensityRenderer.ts'
import { ParticleRenderer } from './TilemapRenderer/ParticleRenderer.ts'
import { TerrainChunkRenderer } from './TilemapRenderer/TerrainChunkRenderer.ts'
import { TerrainEffectRenderer } from './TilemapRenderer/TerrainEffectRenderer.ts'
import { TILEMAP_RENDERER_DEFAULTS, type TilemapRendererConfig } from './TilemapRendererConfig'
import { makeTilemapFragShader, makeTilemapVertShader } from './TilemapRendererShader.ts'
import Shader = GameObjects.Shader
import Color = Phaser.Display.Color
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import CanvasTexture = Phaser.Textures.CanvasTexture

export class TilemapRenderer extends SceneBound {
  private readonly chunkRenderer: TerrainChunkRenderer
  private readonly terrainEffectRenderer: TerrainEffectRenderer
  private readonly particleRenderer: ParticleRenderer
  private readonly liquidDensityRenderer: LiquidDensityRenderer

  constructor(
    public scene: GameLevel,
    readonly terrainBgTexture: CanvasTexture,
    config: Partial<TilemapRendererConfig> = {},
    matterRenderConfig: Partial<MatterRenderConfig> = {},
  ) {
    super(scene)

    const _config = {
      ...TILEMAP_RENDERER_DEFAULTS,
      ...config,
    }

    const _matterRenderConfig = {
      ...MATTER_RENDER_CONFIG_DEFAULTS,
      ...matterRenderConfig,
    }

    const { width, height } = scene.tilemap

    this.chunkRenderer = new TerrainChunkRenderer(scene)
    this.terrainEffectRenderer = new TerrainEffectRenderer(scene)
    this.particleRenderer = new ParticleRenderer(scene, _config.particleRenderEnabled)
    this.liquidDensityRenderer = new LiquidDensityRenderer(scene, _config.debugLiquidPressure)

    // Phaser's shader setter registry only knows sampler2D (0x8B5E). Register
    // usampler2D (UNSIGNED_INT_SAMPLER_2D = 0x8DD2) with the same uniform1i setter.
    const gl = (scene.renderer as WebGLRenderer).gl as WebGL2RenderingContext
    const setters = (scene.renderer as any).shaderSetters as Phaser.Renderer.WebGL.Wrappers.WebGLShaderSetterWrapper

    const constants = setters.constants as any
    const samplerId = gl.UNSIGNED_INT_SAMPLER_2D

    if (!constants[samplerId]) {
      constants[samplerId] = {
        constant: samplerId,
        baseType: gl.INT,
        size: 1,
        bytes: 4,
        set: gl.uniform1i,
        setV: gl.uniform1iv,
        isMatrix: false,
      }
    }

    const shader: Shader = scene.add.shader(
      {
        name: 'TerrainShader',
        vertexSource: makeTilemapVertShader(),
        fragmentSource: makeTilemapFragShader(_config, _matterRenderConfig),
        setupUniforms: (setUniform: (name: string, value: any) => void) => {
          setUniform('uTerrainBg', 0)
          setUniform('uMask', 1)
          setUniform('uEffect', 2)
          setUniform('uParticles', 3)
          setUniform('uLiquidDensity', 4)
          setUniform('uTime', scene.time.now)
        },
      },
      0, 0,
      width, height,
    )

    shader.setOrigin(0, 0)
    shader.setTextures([
      terrainBgTexture,
      this.chunkRenderer.maskTexture,
      this.terrainEffectRenderer.texture,
      this.particleRenderer.texture,
      this.liquidDensityRenderer.texture,
    ])
    scene.layers.terrain.add(shader)

    // Force shader compilation now (during create) to avoid a stall on the first rendered frame.
    ;(shader as any).renderNode?.programManager?.getCurrentProgramSuite?.()
  }

  updateParticlePixels(buf: Uint8Array) {
    this.particleRenderer.updateParticlePixels(buf)
  }

  addColorEffect(tx: number, ty: number, color: Color, startTime?: number) {
    this.terrainEffectRenderer.addEffect(tx, ty, color, startTime)
  }

  render() {
    if (this.destroyed) return

    this.chunkRenderer.update()
    this.terrainEffectRenderer.update()
    this.liquidDensityRenderer.update()
  }

  protected onDestroy() {
    this.chunkRenderer.destroy()
    this.terrainEffectRenderer.destroy()
    this.particleRenderer.destroy()
    this.liquidDensityRenderer.destroy()
  }
}
