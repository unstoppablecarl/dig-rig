import { GameObjects } from 'phaser'
import { FIRE_MODE_COLORS, MATTER_RENDER_CONFIG_DEFAULTS, type MatterRenderConfig } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { FireMode } from '../Player/_FireMode-types'
import type { Tile } from './TileGrid.ts'
import { TerrainChunkRenderer } from './TilemapRenderer/TerrainChunkRenderer.ts'
import { TerrainEffectSystem } from './TilemapRenderer/TerrainEffectSystem.ts'
import { TILEMAP_RENDERER_DEFAULTS, type TilemapRendererConfig } from './TilemapRendererConfig'
import { makeTilemapFragShader } from './TilemapRendererShader.ts'
import Shader = GameObjects.Shader
import Color = Phaser.Display.Color
import CanvasTexture = Phaser.Textures.CanvasTexture

export class TilemapRenderer extends SceneBound {
  private readonly chunkRenderer: TerrainChunkRenderer
  private readonly effectSystem: TerrainEffectSystem
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

    const shader: Shader = scene.add.shader(
      {
        name: 'TerrainShader',
        fragmentSource: makeTilemapFragShader(_config, _matterRenderConfig),
        setupUniforms: (setUniform: (name: string, value: any) => void) => {
          setUniform('uTerrain', 0)
          setUniform('uMask', 1)
          setUniform('uEffect', 2)
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
    ])
    scene.layers.terrain.add(shader)

    // Force shader compilation now (during create) to avoid a stall on the first rendered frame.
    ;(shader as any).renderNode?.programManager?.getCurrentProgramSuite?.()
  }

  addFireModeEffect(tx: number, ty: number, mode: FireMode, startTime?: number) {
    const color = FIRE_MODE_COLORS[mode]
    this.effectSystem.addEffect(tx, ty, color, startTime)
  }

  addFireModeEffectTiles(tiles: Tile[], mode: FireMode): void {
    const startTime = this.scene.time.now
    const color = FIRE_MODE_COLORS[mode]
    for (const { x, y } of tiles) this.effectSystem.addEffect(x, y, color, startTime)
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
