import { CHUNK_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { MatterType } from './_Matter-types.ts'
import { FireMode } from '../Player/_FireMode-types.ts'
import type { Chunk } from '../Tilemap/Chunk.ts'
import SandWorkerConstructor from './matter.worker.ts?worker'

export class MatterBridge extends SceneBound {
  private readonly worker: Worker
  private readonly dirtyBuffer: SharedArrayBuffer
  private readonly dirty: Uint8Array
  private readonly numChunksX: number
  private readonly numChunksY: number

  constructor(public scene: GameLevel) {
    super(scene)

    const { tilemap } = scene
    const { chunkManager } = tilemap

    this.numChunksX = chunkManager.width
    this.numChunksY = chunkManager.height
    this.dirtyBuffer = new SharedArrayBuffer(this.numChunksX * this.numChunksY)
    this.dirty = new Uint8Array(this.dirtyBuffer)

    this.worker = new SandWorkerConstructor()
    this.worker.postMessage({
      type: 'init',
      tilesBuffer: tilemap.tilesBuffer,
      dirtyBuffer: this.dirtyBuffer,
      width: tilemap.width,
      height: tilemap.height,
      chunkSize: CHUNK_SIZE,
    })

    this.worker.onmessage = (e: MessageEvent) => {
      if (e.data.type !== 'settled') return
      const { tilemapRenderer } = this.scene
      const now = this.scene.time.now
      for (const idx of e.data.indices as number[]) {
        const tx = idx % tilemap.width
        const ty = idx / tilemap.width | 0
        tilemapRenderer.addEffect(tx, ty, FireMode.SOLIDIFY, now)
      }
    }

    tilemap.onTileEmpty = (tx, ty) => {
      this.worker.postMessage({ type: 'check', tx, ty })
    }

    tilemap.onIslandDetected = (islands) => {
      for (const { x, y } of islands) {
        tilemap.setTile(x, y, MatterType.SAND)
      }
      this.activateTiles(islands)
    }
  }

  activateTiles(tiles: { x: number, y: number }[]) {
    const { tilemap } = this.scene
    const indices = tiles.map(({ x, y }) => y * tilemap.width + x)
    if (indices.length) {
      this.worker.postMessage({ type: 'activate', indices })
    }
  }

  placeWater(tx: number, ty: number, radius = 8) {
    const { tilemap } = this.scene
    tx = Math.floor(tx)
    ty = Math.floor(ty)
    const indices: number[] = []
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue
        const x = tx + dx
        const y = ty + dy
        if (tilemap.getTile(x, y) !== MatterType.EMPTY) continue
        tilemap.setTile(x, y, MatterType.WATER)
        indices.push(y * tilemap.width + x)
      }
    }
    if (indices.length) {
      this.worker.postMessage({ type: 'activate', indices })
    }
  }

  placeSand(tx: number, ty: number, radius = 8, maxTiles = Number.MAX_SAFE_INTEGER) {
    const { tilemap } = this.scene
    tx = Math.floor(tx)
    ty = Math.floor(ty)
    const indices: number[] = []
    // Place a tall column above (tx, ty) so grains fall in sequence, producing a
    // visible stream rather than a single burst that sinks too fast to see.
    const halfW = Math.max(1, Math.ceil(radius / 2))
    const colHeight = radius * 2
    outer: for (let dy = -colHeight; dy < 0; dy++) {
      for (let dx = -halfW; dx <= halfW; dx++) {
        if (indices.length >= maxTiles) break outer
        const x = tx + dx
        const y = ty + dy
        if (tilemap.getTile(x, y) !== MatterType.EMPTY) continue
        tilemap.setTile(x, y, MatterType.SAND)
        indices.push(y * tilemap.width + x)
      }
    }
    if (indices.length) {
      this.worker.postMessage({ type: 'activate', indices })
    }
    return indices.length
  }

  update() {
    if (this.destroyed) return

    const { tilemap } = this.scene
    const { chunkManager } = tilemap

    for (let cy = 0; cy < this.numChunksY; cy++) {
      for (let cx = 0; cx < this.numChunksX; cx++) {
        const chunkIdx = cy * this.numChunksX + cx
        if (!this.dirty[chunkIdx]) continue
        this.dirty[chunkIdx] = 0

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
    this.worker.terminate()
    // @ts-expect-error: destroy
    this.worker = null
  }
}
