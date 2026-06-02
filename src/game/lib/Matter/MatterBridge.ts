import { CHUNK_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { FireMode } from '../Player/_FireMode-types.ts'
import type { Chunk } from '../Tilemap/Chunk.ts'
import type { Tile } from '../Tilemap/Tilemap.ts'
import { MatterType, TYPE_MASK } from './_Matter-types.ts'
import { MatterWorkerInMsg, MatterWorkerOutMsg, type TypedMatterWorker } from './_MatterWorker-types.ts'
import { ParticleLayer } from '../Particles/ParticleLayer.ts'
import ParticleWorkerConstructor from './matter.worker.ts?worker'

export class MatterBridge extends SceneBound {
  private readonly worker: TypedMatterWorker
  private readonly dirtyChunksBuffer: SharedArrayBuffer
  private readonly dirtyChunks: Uint8Array
  private readonly numChunksX: number
  private readonly numChunksY: number
  private readonly particleLayer: ParticleLayer

  constructor(public scene: GameLevel) {
    super(scene)

    const tilemap = this.scene.tilemap
    const chunkManager = tilemap.chunkManager

    this.numChunksX = chunkManager.width
    this.numChunksY = chunkManager.height
    this.dirtyChunksBuffer = new SharedArrayBuffer(this.numChunksX * this.numChunksY)
    this.dirtyChunks = new Uint8Array(this.dirtyChunksBuffer)

    this.particleLayer = new ParticleLayer(this.scene)

    this.worker = new ParticleWorkerConstructor()
    this.worker.postMessage({
      type: MatterWorkerInMsg.INIT,
      tilesBuffer: tilemap.tilesBuffer,
      dirtyChunksBuffer: this.dirtyChunksBuffer,
      width: tilemap.width,
      height: tilemap.height,
      chunkSize: CHUNK_SIZE,
    })

    this.worker.onmessage = (e) => {
      if (e.data.type === MatterWorkerOutMsg.SETTLED) {
        const { tilemapRenderer } = this.scene
        const now = this.scene.time.now
        for (const idx of e.data.indices) {
          const tx = idx % tilemap.width
          const ty = idx / tilemap.width | 0
          tilemapRenderer.addEffect(tx, ty, FireMode.SOLIDIFY, now)
        }
        return
      }

      if (e.data.type === MatterWorkerOutMsg.SPAWN_PARTICLE) {
        this.particleLayer.spawn(e.data.particleType, e.data.x, e.data.y)
      }
    }

    tilemap.onTileEmpty = (tx, ty) => {
      this.worker.postMessage({ type: MatterWorkerInMsg.CHECK, tx, ty })
    }

    tilemap.onIslandDetected = (islands) => {
      for (const { x, y } of islands) {
        tilemap.setTile(x, y, MatterType.SAND)
      }
      this.activateTiles(islands)
    }

    tilemap.onActivateTiles = (tiles) => {
      this.activateTiles(tiles)
    }
  }

  activateTiles(tiles: Tile[]) {
    const tilemap = this.scene.tilemap
    const indices = tiles.map(({ x, y }) => y * tilemap.width + x)
    if (indices.length) {
      this.worker.postMessage({ type: MatterWorkerInMsg.ACTIVATE, indices })
    }
  }

  addElement(value: MatterType, tx: number, ty: number, radius = 8) {
    const { tilemap } = this.scene
    tx = Math.floor(tx)
    ty = Math.floor(ty)
    const indices: number[] = []
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue
        const x = tx + dx
        const y = ty + dy
        if ((tilemap.getTile(x, y) & TYPE_MASK) !== MatterType.EMPTY) continue
        tilemap.setTile(x, y, value)
        indices.push(y * tilemap.width + x)
      }
    }
    if (indices.length) {
      this.worker.postMessage({ type: MatterWorkerInMsg.ACTIVATE, indices })
    }
  }

  update() {
    if (this.destroyed) return

    this.particleLayer.update()

    const chunkManager = this.scene.tilemap.chunkManager

    for (let cy = 0; cy < this.numChunksY; cy++) {
      for (let cx = 0; cx < this.numChunksX; cx++) {
        const chunkIdx = cy * this.numChunksX + cx
        if (!this.dirtyChunks[chunkIdx]) continue
        this.dirtyChunks[chunkIdx] = 0

        const chunk = chunkManager.getChunk(cx, cy)
        if (!chunk) continue

        this.resyncSolidCount(chunk, cx, cy)
        chunk.renderDirty = true
        chunk.collisionDirty = true

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue
            const neighbor = chunkManager.getChunk(cx + dx, cy + dy)
            if (neighbor) neighbor.renderDirty = true
          }
        }
      }
    }
  }

  private resyncSolidCount(chunk: Chunk, cx: number, cy: number) {
    const { tilemap } = this.scene
    let count = 0
    const x0 = cx * CHUNK_SIZE
    const y0 = cy * CHUNK_SIZE
    const x1 = Math.min(x0 + CHUNK_SIZE, tilemap.width)
    const y1 = Math.min(y0 + CHUNK_SIZE, tilemap.height)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (tilemap.isSolid(x, y)) count++
      }
    }
    chunk.solidTileCount = count
  }

  protected onDestroy() {
    this.scene.tilemap.onTileEmpty = undefined
    this.scene.tilemap.onIslandDetected = undefined
    this.scene.tilemap.onActivateTiles = undefined
    this.worker.terminate()
    // @ts-expect-error: destroy
    this.worker = null
  }
}
