import { ChunkGrid, type ChunkGridBuffers } from '../Tilemap/ChunkGrid.ts'
import type { Tilemap } from '../Tilemap/Tilemap.ts'
import { type MatterTankManagerBuffers, MatterTankManagerData } from './data/MatterTankManagerData.ts'
import { ParticleData, type ParticleBuffers } from './data/ParticleData.ts'
import { PlayerBoundsData, type PlayerBoundsDataType } from './data/PlayerBoundsData.ts'
import { type ProjectileBuffers, ProjectileManagerData } from './data/ProjectileManagerData.ts'
import { TunnelWeaponData, type TunnelWeaponDataType } from './data/TunnelWeaponData.ts'
import { VFXParticleData } from './data/VFXParticleData.ts'
import { VFXParticleOverflowData } from './data/VFXParticleOverflowData.ts'
import { VFXSettledTileData } from './data/VFXSettledTileData.ts'
import { VFXTileEffectData } from './data/VFXTileEffectData.ts'

export type DataManagerBuffers = {
  chunkGrid: ChunkGridBuffers
  particle: ParticleBuffers
  matterTankManager: MatterTankManagerBuffers
  playerBounds: SharedArrayBuffer
  projectileManager: ProjectileBuffers
  tunnelWeapon: SharedArrayBuffer
  vfxParticleCreate: SharedArrayBuffer
  vfxParticleDestroy: SharedArrayBuffer
  vfxParticleOverflow: SharedArrayBuffer
  vfxSettledTile: SharedArrayBuffer
  vfxTileEffect: SharedArrayBuffer

  tiles: SharedArrayBuffer

  width: number
  height: number
}

export class DataManager {
  readonly chunkGrid: ChunkGrid
  readonly particle: ParticleData
  readonly matterTankManager: MatterTankManagerData
  readonly playerBounds: PlayerBoundsDataType
  readonly projectileManager: ProjectileManagerData
  readonly tunnelWeapon: TunnelWeaponDataType
  readonly vfxParticleCreate: VFXParticleData
  readonly vfxParticleDestroy: VFXParticleData
  readonly vfxParticleOverflow: VFXParticleOverflowData
  readonly vfxSettledTile: VFXSettledTileData
  readonly vfxTileEffect: VFXTileEffectData

  static make(tilemap: Tilemap): DataManager {
    const buffers: DataManagerBuffers = {
      chunkGrid: tilemap.chunkGrid.buffers,
      particle: ParticleData.makeBuffers(tilemap.width, tilemap.height),
      matterTankManager: MatterTankManagerData.makeBuffer(),
      playerBounds: PlayerBoundsData.makeBuffer(),
      projectileManager: ProjectileManagerData.makeBuffer(),
      tunnelWeapon: TunnelWeaponData.makeBuffer(),
      vfxParticleCreate: VFXParticleData.makeBuffer(),
      vfxParticleDestroy: VFXParticleData.makeBuffer(),
      vfxParticleOverflow: VFXParticleOverflowData.makeBuffer(),
      vfxSettledTile: VFXSettledTileData.makeBuffer(),
      vfxTileEffect: VFXTileEffectData.makeBuffer(),
      tiles: tilemap.tilesBuffer,
      width: tilemap.width,
      height: tilemap.height,
    }

    return new DataManager(buffers)
  }

  constructor(readonly buffers: DataManagerBuffers) {
    this.chunkGrid = ChunkGrid.fromBuffers(buffers.chunkGrid)
    this.particle = new ParticleData(buffers.particle)
    this.matterTankManager = MatterTankManagerData.fromBuffers(buffers.matterTankManager)
    this.playerBounds = PlayerBoundsData.fromBuffer(buffers.playerBounds)
    this.projectileManager = new ProjectileManagerData(buffers.projectileManager)
    this.tunnelWeapon = TunnelWeaponData.fromBuffer(buffers.tunnelWeapon)
    this.vfxParticleCreate = new VFXParticleData(buffers.vfxParticleCreate)
    this.vfxParticleDestroy = new VFXParticleData(buffers.vfxParticleDestroy)
    this.vfxParticleOverflow = new VFXParticleOverflowData(buffers.vfxParticleOverflow)
    this.vfxSettledTile = new VFXSettledTileData(buffers.vfxSettledTile)
    this.vfxTileEffect = new VFXTileEffectData(buffers.vfxTileEffect)
  }
}