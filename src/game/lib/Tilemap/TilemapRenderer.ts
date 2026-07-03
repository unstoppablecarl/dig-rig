import { GameObjects } from 'phaser'
import { MATTER_RENDER_CONFIG_DEFAULTS, type MatterRenderConfig } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { TerrainChunkRenderer } from './TilemapRenderer/TerrainChunkRenderer.ts'
import { TerrainEffectSystem } from './TilemapRenderer/TerrainEffectSystem.ts'
import { TILEMAP_RENDERER_DEFAULTS, type TilemapRendererConfig } from './TilemapRendererConfig'
import { makeTilemapFragShader, makeTilemapVertShader } from './TilemapRendererShader.ts'
import Shader = GameObjects.Shader
import Color = Phaser.Display.Color
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import WebGLTextureWrapper = Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper
import CanvasTexture = Phaser.Textures.CanvasTexture

export class TilemapRenderer extends SceneBound {
  private readonly chunkRenderer: TerrainChunkRenderer
  private readonly effectSystem: TerrainEffectSystem
  private readonly particleTexture: Phaser.Textures.Texture
  private readonly particleWrapper: WebGLTextureWrapper
  private readonly _lastRenderGen: Uint8Array

  constructor(
    public scene: GameLevel,
    readonly terrainTexture: CanvasTexture,
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
    this.effectSystem = new TerrainEffectSystem(scene)
    const { chunkGrid } = scene.tilemap
    this._lastRenderGen = new Uint8Array(chunkGrid.chunksWide * chunkGrid.chunksHigh)

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

    const [particleTexture, particleWrapper] = scene.initGLTexture('particle-pixels', width, height)
    this.particleTexture = particleTexture
    this.particleWrapper = particleWrapper
    const shader: Shader = scene.add.shader(
      {
        name: 'TerrainShader',
        vertexSource: makeTilemapVertShader(),
        fragmentSource: makeTilemapFragShader(_config, _matterRenderConfig),
        setupUniforms: (setUniform: (name: string, value: any) => void) => {
          setUniform('uTerrain', 0)
          setUniform('uMask', 1)
          setUniform('uEffect', 2)
          setUniform('uParticles', 3)
          setUniform('uTime', scene.time.now)
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
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  addColorEffect(tx: number, ty: number, color: Color, startTime?: number) {
    this.effectSystem.addEffect(tx, ty, color, startTime)
  }

  render() {
    if (this.destroyed) return

    const { chunkGrid, chunkMap } = this.scene.tilemap

    this.chunkRenderer.beginBatch()
    for (let cy = 0; cy < chunkGrid.chunksHigh; cy++) {
      for (let cx = 0; cx < chunkGrid.chunksWide; cx++) {
        const idx = chunkGrid.idx(cx, cy)
        const gen = chunkGrid.getRenderGen(idx)
        if (gen === this._lastRenderGen[idx]) continue
        const chunk = chunkMap.get(cx, cy)!
        this.chunkRenderer.renderChunk(chunk)
        this._lastRenderGen[idx] = gen
      }
    }

    this.chunkRenderer.endBatch()

    this.effectSystem.update()
  }

  protected onDestroy() {
    this.chunkRenderer.destroy()
    this.effectSystem.destroy()
  }
}
