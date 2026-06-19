import { CHUNK_SIZE, VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { ParticleBridge } from '../Particles/ParticleBridge.ts'
import type { Chunk } from '../Tilemap/Chunk.ts'
import type { Tile } from '../Tilemap/Tilemap.ts'
import { getSupport, matterType, MatterType, SupportType } from './_Matter.types.ts'
import { getSupportType, setSupport, STRUCTURAL_COLLAPSE_TO } from './matter.ts'
import type { CoordinatorInMessageApplyEffect, CoordinatorOutMsgApplyEffectResult } from './MatterCoordinator.types.ts'
import { MatterCoordinatorWorkerController } from './MatterCoordinatorWorkerController.ts'
import type { MatterTankId } from './MatterTank/_MatterTank.types.ts'

export type ApplyEffectParams = Omit<CoordinatorInMessageApplyEffect, 'type' | 'requestId'>
export type ApplyEffectCallback = (result: CoordinatorOutMsgApplyEffectResult) => void

export class MatterBridge extends SceneBound {
  private readonly workerController: MatterCoordinatorWorkerController
  private readonly dirtyChunksBuffer: SharedArrayBuffer
  private readonly dirtyChunks: Uint8Array
  private readonly numChunksX: number
  private readonly numChunksY: number
  private readonly particleBridge: ParticleBridge
  private readonly pendingEffects = new Map<number, ApplyEffectCallback>()
  private _nextRequestId = 1

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
      this.workerController.activate(indices)
    }

    this.workerController = new MatterCoordinatorWorkerController({
      tilesBuffer: tilemap.tilesBuffer,
      dirtyChunksBuffer: this.dirtyChunksBuffer,
      width: tilemap.width,
      height: tilemap.height,
      chunkSize: CHUNK_SIZE,
    }, {
      settled: (indices) => {
        const { tilemapRenderer } = this.scene
        const now = this.scene.time.now
        for (const idx of indices) {
          const color = (this.scene.matterRenderConfig as Partial<Record<MatterType, {
            settledTransitionColor?: Phaser.Display.Color
          }>>)[matterType(tilemap.tiles[idx])]?.settledTransitionColor
          if (!color) continue
          const tx = idx % tilemap.width
          const ty = idx / tilemap.width | 0
          tilemapRenderer.addColorEffect(tx, ty, color, now)
        }
      },
      spawnParticle: (particleType, x, y, ownerId) => {
        this.particleBridge.queueSpawn(particleType, x, y, ownerId)
      },
      applyEffectResult: (result) => {
        this._onApplyEffectResult(result)
      },
      transferToMatterTanks: (transfers) => {
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
              tank.source,
              false,
            )
          }
        }
      },
    })

    tilemap.onTileEmpty = (tx, ty) => {
      this.workerController.check(tx, ty)
    }

    tilemap.onIslandDetected = (islands) => {
      for (const { x, y } of islands) {
        const raw = tilemap.getTile(x, y)
        const t = matterType(raw)
        const collapseType = STRUCTURAL_COLLAPSE_TO[t]
        if (collapseType !== undefined) {
          tilemap.setTile(x, y, collapseType)
        } else if (getSupport(raw) === SupportType.STRUCTURAL) {
          // No type conversion — clear the per-tile structural support so the tile
          // resumes normal simulation (e.g. structural GUNPOWDER falls again).
          const cleared = setSupport(raw, SupportType.NONE)
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

  sendApplyEffect(params: ApplyEffectParams, callback?: ApplyEffectCallback) {
    const requestId = callback ? this._nextRequestId++ : 0
    if (callback) this.pendingEffects.set(requestId, callback)
    this.workerController.applyEffect({ requestId, ...params })
  }

  private _onApplyEffectResult(result: CoordinatorOutMsgApplyEffectResult) {
    if (result.requestId !== 0) {
      const cb = this.pendingEffects.get(result.requestId)
      if (cb) {
        this.pendingEffects.delete(result.requestId)
        cb(result)
      }
    }
  }

  activateTiles(tiles: Tile[]) {
    const tilemap = this.scene.tilemap
    const indices = tiles.map(({ x, y }) => y * tilemap.width + x)
    if (indices.length) {
      this.workerController.activate(indices)
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
    this.workerController.activate(indices)
    if (getSupportType(value) >= SupportType.STRUCTURAL) {
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
    this.workerController.terminate()
    // @ts-expect-error: destroy
    this.workerController = null
  }
}
