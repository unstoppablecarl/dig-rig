import { ChunkGrid, type ChunkGridBuffers } from '../Tilemap/ChunkGrid.ts'
import type { Tilemap } from '../Tilemap/Tilemap.ts'
import { type BasicTilesBuffer, BasicTilesData } from './data/BasicTilesData.ts'
import { type MatterTankManagerBuffers, MatterTankManagerData } from './data/MatterTankManagerData.ts'
import { ParticleDataDraw, type ParticlesBuffers } from './data/ParticleDataDraw.ts'
import { ParticleSpawnData } from './data/ParticleSpawnData.ts'
import { type PhysicsBodiesBuffers, PhysicsBodiesData } from './data/PhysicsBodiesData.ts'
import { PlayerBoundsData, type PlayerBoundsDataType } from './data/PlayerBoundsData.ts'
import { type ProjectileBuffers, ProjectileManagerData } from './data/ProjectileManagerData.ts'
import { SimStatsData, type SimStatsDataType } from './data/SimStatsData.ts'
import { type TileFrontBuffers, TileFrontData } from './data/TileFrontData.ts'
import { TunnelWeaponData, type TunnelWeaponDataType } from './data/TunnelWeaponData.ts'
import { VFXParticleData } from './data/VFXParticleData.ts'
import { VFXParticleOverflowData } from './data/VFXParticleOverflowData.ts'
import { VFXSettledTileData, type VFXSettledTilesBuffer } from './data/VFXSettledTileData.ts'
import { VFXTileEffectData } from './data/VFXTileEffectData.ts'

export type DataManagerBuffers = {
  chunkGrid: ChunkGridBuffers
  particle: ParticlesBuffers
  matterTankManager: MatterTankManagerBuffers
  playerBounds: SharedArrayBuffer
  projectileManager: ProjectileBuffers
  tunnelWeapon: SharedArrayBuffer
  vfxParticleCreate: SharedArrayBuffer
  vfxParticleDestroy: SharedArrayBuffer
  vfxParticleOverflow: SharedArrayBuffer
  vfxSettledTile: VFXSettledTilesBuffer
  vfxTileEffect: SharedArrayBuffer
  activateTiles: BasicTilesBuffer
  physicsBodies: PhysicsBodiesBuffers
  particleSpawns: SharedArrayBuffer
  simStats: SharedArrayBuffer

  tiles: SharedArrayBuffer
  fill: SharedArrayBuffer
  matterTouched: SharedArrayBuffer
  tileFront: TileFrontBuffers
  // One Int32 per map column — see MatterSim.lavaColumnTop.
  lavaColumnTop: SharedArrayBuffer
  width: number
  height: number
}

export class DataManager {
  readonly chunkGrid: ChunkGrid
  readonly particle: ParticleDataDraw
  readonly matterTankManager: MatterTankManagerData
  readonly playerBounds: PlayerBoundsDataType
  readonly projectileManager: ProjectileManagerData
  readonly tunnelWeapon: TunnelWeaponDataType
  readonly vfxParticleCreate: VFXParticleData
  readonly vfxParticleDestroy: VFXParticleData
  readonly vfxParticleOverflow: VFXParticleOverflowData
  readonly vfxSettledTile: VFXSettledTileData
  readonly vfxTileEffect: VFXTileEffectData
  readonly activateTiles: BasicTilesData
  readonly tiles: Uint32Array
  readonly fill: Uint32Array
  readonly tileFront: TileFrontData
  readonly physicsBodies: PhysicsBodiesData
  readonly particleSpawns: ParticleSpawnData
  readonly simStats: SimStatsDataType

  static make(tilemap: Tilemap): DataManager {

    const { width, height } = tilemap
    const buffers: DataManagerBuffers = {
      chunkGrid: tilemap.chunkGrid.buffers,
      particle: ParticleDataDraw.makeBuffers(width, height),
      matterTankManager: MatterTankManagerData.makeBuffer(),
      playerBounds: PlayerBoundsData.makeBuffer(),
      projectileManager: ProjectileManagerData.makeBuffer(),
      tunnelWeapon: TunnelWeaponData.makeBuffer(),
      vfxParticleCreate: VFXParticleData.makeBuffer(),
      vfxParticleDestroy: VFXParticleData.makeBuffer(),
      vfxParticleOverflow: VFXParticleOverflowData.makeBuffer(),
      vfxSettledTile: VFXSettledTileData.makeBuffer(width, height),
      vfxTileEffect: VFXTileEffectData.makeBuffer(),
      activateTiles: BasicTilesData.makeBuffer(width, height),
      tiles: tilemap.buffers.tiles,
      fill: tilemap.buffers.fillLevels,
      matterTouched: tilemap.buffers.matterTouched,
      lavaColumnTop: new SharedArrayBuffer(width * Int32Array.BYTES_PER_ELEMENT),
      tileFront: TileFrontData.makeBuffers(tilemap),
      physicsBodies: PhysicsBodiesData.makeBuffers(),
      particleSpawns: ParticleSpawnData.makeBuffer(),
      simStats: SimStatsData.makeBuffer(),
      width,
      height,
    }

    return new DataManager(buffers)
  }

  constructor(readonly buffers: DataManagerBuffers) {
    this.chunkGrid = new ChunkGrid(buffers.chunkGrid)
    this.particle = new ParticleDataDraw(buffers.particle)
    this.matterTankManager = new MatterTankManagerData(buffers.matterTankManager)
    this.playerBounds = PlayerBoundsData.fromBuffer(buffers.playerBounds)
    this.projectileManager = new ProjectileManagerData(buffers.projectileManager)
    this.tunnelWeapon = TunnelWeaponData.fromBuffer(buffers.tunnelWeapon)
    this.vfxParticleCreate = new VFXParticleData(buffers.vfxParticleCreate)
    this.vfxParticleDestroy = new VFXParticleData(buffers.vfxParticleDestroy)
    this.vfxParticleOverflow = new VFXParticleOverflowData(buffers.vfxParticleOverflow)
    this.vfxSettledTile = new VFXSettledTileData(buffers.vfxSettledTile)
    this.vfxTileEffect = new VFXTileEffectData(buffers.vfxTileEffect)
    this.activateTiles = new BasicTilesData(buffers.activateTiles)
    this.tiles = new Uint32Array(buffers.tiles)
    this.fill = new Uint32Array(buffers.fill)
    this.tileFront = new TileFrontData(buffers.tileFront)
    this.physicsBodies = new PhysicsBodiesData(buffers.physicsBodies)
    this.particleSpawns = new ParticleSpawnData(buffers.particleSpawns)
    this.simStats = SimStatsData.fromBuffer(buffers.simStats)
  }
}
