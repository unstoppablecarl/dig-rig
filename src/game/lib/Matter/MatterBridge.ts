import { CHUNK_SIZE, VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE } from '../../config.ts'
import { SETTLE_TRANSITION_COLORS } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { ParticleBridge } from '../Particles/ParticleBridge.ts'
import type { Chunk } from '../Tilemap/Chunk.ts'
import type { Tile } from '../Tilemap/Tilemap.ts'
import { isStructural, STRUCTURAL_COLLAPSE_TO } from './_Matter-meta'
import { isStructuralFlag, matterType, MatterType, setStructuralFlag } from './_Matter.types.ts'
import MatterCoordinatorConstructor from './MatterCoordinator.worker.ts?worker'
import {
  MatterCoordinatorInMsg,
  MatterCoordinatorOutMsg,
  type TypedMatterCoordinatorWorker,
} from './MatterSim.types.ts'
import { type MatterTankId } from './MatterTank/_MatterTank.types.ts'

export class MatterBridge extends SceneBound {
  private readonly worker: TypedMatterCoordinatorWorker
  private readonly dirtyChunksBuffer: SharedArrayBuffer
  private readonly dirtyChunks: Uint8Array
  private readonly numChunksX: number
  private readonly numChunksY: number
  private readonly particleBridge: ParticleBridge

  constructor(public scene: GameLevel) {
    super(scene)

    const tilemap = this.scene.tilemap
    const chunkManager = tilemap.chunkManager

    this.numChunksX = chunkManager.width
    this.numChunksY = chunkManager.height
    this.dirtyChunksBuffer = new SharedArrayBuffer(this.numChunksX * this.numChunksY)
    this.dirtyChunks = new Uint8Array(this.dirtyChunksBuffer)

    this.particleBridge = new ParticleBridge(this.scene)
    this.particleBridge.onActivations = (indices) => {
      this.worker?.postMessage({ type: MatterCoordinatorInMsg.ACTIVATE, indices })
    }

    this.worker = new MatterCoordinatorConstructor()
    this.worker.postMessage({
      type: MatterCoordinatorInMsg.INIT,
      tilesBuffer: tilemap.tilesBuffer,
      dirtyChunksBuffer: this.dirtyChunksBuffer,
      width: tilemap.width,
      height: tilemap.height,
      chunkSize: CHUNK_SIZE,
    })

    this.worker.onmessage = (e) => {
      if (e.data.type === MatterCoordinatorOutMsg.SETTLED) {
        const { tilemapRenderer } = this.scene
        const now = this.scene.time.now
        for (const idx of e.data.indices) {
          const color = SETTLE_TRANSITION_COLORS[matterType(tilemap.tiles[idx])]
          if (!color) continue
          const tx = idx % tilemap.width
          const ty = idx / tilemap.width | 0
          tilemapRenderer.addColorEffect(tx, ty, color, now)
        }
        return
      }

      if (e.data.type === MatterCoordinatorOutMsg.SPAWN_PARTICLE) {
        this.particleBridge.queueSpawn(e.data.particleType, e.data.x, e.data.y, e.data.ownerId)
      }

      if (e.data.type === MatterCoordinatorOutMsg.TRANSFER_TO_MATTER_TANKS) {
        const { transfers } = e.data
        // Track which tile chunks have already spawned a VFX particle this batch.
        // Key packs (tankId << 22) | (cy << 11) | cx, valid for maps up to 4096 tiles wide.
        const spawnedChunks = new Set<number>()
        for (let i = 0; i < transfers.length; i += 3) {
          const tx = transfers[i]
          const ty = transfers[i + 1]
          const tankId = transfers[i + 2] as MatterTankId
          const tank = this.scene.matterManager.get(tankId)
          if (!tank) continue
          tank.forceAdd(1)
          const cx = Math.floor(tx / VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE)
          const cy = Math.floor(ty / VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE)
          const key = (tankId << 22) | (cy << 11) | cx
          if (!spawnedChunks.has(key)) {
            spawnedChunks.add(key)
            this.scene.vfxParticleManager.spawnMatter(
              {
                x: (cx + 0.5) * VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE,
                y: (cy + 0.5) * VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE,
              },
              tank.getCollectPos(),
              false,
            )
          }
        }
      }
    }

    tilemap.onTileEmpty = (tx, ty) => {
      this.worker.postMessage({ type: MatterCoordinatorInMsg.CHECK, tx, ty })
    }

    tilemap.onIslandDetected = (islands) => {
      for (const { x, y } of islands) {
        const raw = tilemap.getTile(x, y)
        const t = matterType(raw)
        const collapseType = STRUCTURAL_COLLAPSE_TO[t]
        if (collapseType !== undefined) {
          tilemap.setTile(x, y, collapseType)
        } else if (isStructuralFlag(raw)) {
          // No type conversion — clear the per-tile structural flag so the tile
          // resumes normal simulation (e.g. structural GUNPOWDER falls again).
          const cleared = setStructuralFlag(raw, false)
          tilemap.tiles[y * tilemap.width + x] = cleared
          tilemap.chunkManager.setDirty(x, y, raw, cleared)
        }
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
      this.worker.postMessage({ type: MatterCoordinatorInMsg.ACTIVATE, indices })
    }
  }

  addMatter(value: MatterType, tx: number, ty: number, radius = 8) {
    const { tilemap } = this.scene
    tx = Math.floor(tx)
    ty = Math.floor(ty)
    const indices: number[] = []
    const placed: Tile[] = []
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue
        const x = tx + dx
        const y = ty + dy
        if (matterType(tilemap.getTile(x, y)) !== MatterType.EMPTY) continue
        tilemap.setTile(x, y, value)
        indices.push(y * tilemap.width + x)
        placed.push({ x, y })
      }
    }
    if (!indices.length) return
    this.worker.postMessage({ type: MatterCoordinatorInMsg.ACTIVATE, indices })
    if (isStructural(value)) {
      tilemap.chunkManager.computeAnchored()
      const islands = tilemap.findIslandTiles(placed)
      if (islands.length) tilemap.onIslandDetected?.(islands)
    }
  }

  update() {
    if (this.destroyed) return

    this.particleBridge.update()

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
        if (tilemap.isCollidable(x, y)) count++
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
