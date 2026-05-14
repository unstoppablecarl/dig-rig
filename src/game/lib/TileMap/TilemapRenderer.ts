import { GameObjects } from 'phaser'
import { CHUNK_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Chunk } from './Chunk.ts'
import { TerrainType } from './TileMap.ts'
import Shader = GameObjects.Shader
import CanvasTexture = Phaser.Textures.CanvasTexture
import NEAREST = Phaser.Textures.FilterMode.NEAREST
import Texture = Phaser.Textures.Texture

// R channel encodes tile state; A is always 255 to avoid premultiplied alpha side effects.
// Little-endian Uint32: 0xAABBGGRR
// Little-endian ABGR pixel values. R channel encodes state; A is always 255.
const MASK_EMPTY = 0xFF000000 // R=0   → 0.00 in shader (empty mask, glow off)
const MASK_SOLID = 0xFF000080 // R=128 → ~0.50 in shader
const MASK_PERM = 0xFF0000FF // R=255 → 1.00 in shader
const GLOW_ON = 0xFF0000FF  // R=255 → 1.00 in shader

const FRAG_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uTerrain;
uniform sampler2D uMask;
uniform sampler2D uGlow;
uniform vec3 uGlowColor;

varying vec2 outTexCoord;

void main() {
  float mask = texture2D(uMask, outTexCoord).r;

  if (mask > 0.75) {
    gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
  } else if (mask > 0.25) {
    gl_FragColor = texture2D(uTerrain, outTexCoord);
  } else {
    float glow = texture2D(uGlow, outTexCoord).r;
    if (glow < 0.01) discard;
    gl_FragColor = vec4(uGlowColor, glow);
  }
}
`

export class TilemapRenderer extends SceneBound {
  private maskTexture: CanvasTexture
  private glowTexture: CanvasTexture

  private chunkBuf = new ImageData(CHUNK_SIZE, CHUNK_SIZE)
  private chunkPixels = new Uint32Array(this.chunkBuf.data.buffer)

  private destroyed = false

  constructor(
    public scene: GameLevel,
    terrainTexture: Texture,
  ) {
    super(scene)

    const { width, height } = scene.tilemap

    if (scene.textures.exists('terrain_mask')) scene.textures.remove('terrain_mask')
    if (scene.textures.exists('terrain_glow')) scene.textures.remove('terrain_glow')
    this.maskTexture = scene.textures.createCanvas('terrain_mask', width, height)!
    this.glowTexture = scene.textures.createCanvas('terrain_glow', width, height)!

    const shader: Shader = scene.add.shader(
      {
        name: 'TerrainShader',
        fragmentSource: FRAG_SHADER,
        setupUniforms: (setUniform: (name: string, value: any) => void) => {
          setUniform('uTerrain', 0)
          setUniform('uMask', 1)
          setUniform('uGlow', 2)
          setUniform('uGlowColor', [0.2, 0.8, 1.0])
        },
      },
      0, 0,
      width, height,
    )
    shader.setOrigin(0, 0)
    // setTextures accepts Texture[] at runtime but the TS type only declares string[]
    shader.setTextures([terrainTexture, this.maskTexture, this.glowTexture] as any)
    scene.layers.terrain.add(shader)
  }

  render() {
    if (this.destroyed) return
    const chunkManager = this.scene.tilemap.chunkManager
    let anyDirty = false

    for (let cy = 0; cy < chunkManager.height; cy++) {
      for (let cx = 0; cx < chunkManager.width; cx++) {
        const chunk = chunkManager.getChunk(cx, cy)
        if (!chunk?.renderDirty) continue
        anyDirty = true
        this.renderChunkMask(chunk)
        this.renderChunkGlow(chunk)
        chunk.renderDirty = false
      }
    }

    if (anyDirty) {
      this.maskTexture.refresh()
      this.maskTexture.source[0].setFilter(NEAREST)
      this.glowTexture.refresh()
      this.glowTexture.source[0].setFilter(NEAREST)
    }
  }

  private renderChunkMask(chunk: Chunk) {
    const pixels = this.chunkPixels
    const tilemap = this.scene.tilemap
    const offX = chunk.cx * CHUNK_SIZE
    const offY = chunk.cy * CHUNK_SIZE

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = tilemap.getTile(offX + x, offY + y)
        pixels[y * CHUNK_SIZE + x] =
          tile === TerrainType.PERMANENT ? MASK_PERM :
          tile === TerrainType.SOLID     ? MASK_SOLID :
          MASK_EMPTY
      }
    }

    this.maskTexture.context.putImageData(this.chunkBuf, offX, offY)
  }

  private renderChunkGlow(chunk: Chunk) {
    const pixels = this.chunkPixels
    const tilemap = this.scene.tilemap
    const offX = chunk.cx * CHUNK_SIZE
    const offY = chunk.cy * CHUNK_SIZE

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tx = offX + x
        const ty = offY + y
        const hasGlow =
          tilemap.getTile(tx, ty) === TerrainType.EMPTY &&
          (tilemap.getTile(tx - 1, ty) !== TerrainType.EMPTY ||
            tilemap.getTile(tx + 1, ty) !== TerrainType.EMPTY ||
            tilemap.getTile(tx, ty - 1) !== TerrainType.EMPTY ||
            tilemap.getTile(tx, ty + 1) !== TerrainType.EMPTY)
        pixels[y * CHUNK_SIZE + x] = hasGlow ? GLOW_ON : MASK_EMPTY
      }
    }

    this.glowTexture.context.putImageData(this.chunkBuf, offX, offY)
  }

  destroy() {
    this.destroyed = true
    this.maskTexture?.destroy()
    this.glowTexture?.destroy()
    // @ts-expect-error: destroy
    this.maskTexture = null
    // @ts-expect-error: destroy
    this.glowTexture = null
    super.destroy()
  }
}
