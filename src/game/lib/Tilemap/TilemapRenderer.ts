import { GameObjects } from 'phaser'
import { FIRE_MODE_COLORS, MATTER_RENDER_CONFIG_DEFAULTS, type MatterRenderConfig } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { FireMode } from '../Player/_FireMode-types'
import { TerrainChunkRenderer } from './TilemapRenderer/TerrainChunkRenderer.ts'
import { TerrainEffectSystem } from './TilemapRenderer/TerrainEffectSystem.ts'
import { TILEMAP_RENDERER_DEFAULTS, type TilemapRendererConfig } from './TilemapRendererConfig'
import { makeTilemapFragShader } from './TilemapRendererShader.ts'
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

    const [particleTexture, particleWrapper] = scene.initGLTexture('particle-pixels', width, height)
    this.particleTexture = particleTexture
    this.particleWrapper = particleWrapper

    const shader: Shader = scene.add.shader(
      {
        name: 'TerrainShader',
        fragmentSource: makeTilemapFragShader(_config, _matterRenderConfig),
        setupUniforms: (setUniform: (name: string, value: any) => void) => {
          setUniform('uTerrain', 0)
          setUniform('uMask', 1)
          setUniform('uEffect', 2)
          setUniform('uParticles', 3)
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
