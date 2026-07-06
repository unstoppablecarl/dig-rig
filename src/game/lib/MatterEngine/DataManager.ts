import { ChunkGrid, type ChunkGridBuffers } from '../Tilemap/ChunkGrid.ts'
import type { Tilemap } from '../Tilemap/Tilemap.ts'
import { type ActivateTilesBuffer, ActivateTilesData } from './data/ActivateTilesData.ts'
import { type MatterTankManagerBuffers, MatterTankManagerData } from './data/MatterTankManagerData.ts'
import { ParticleData, type ParticlesBuffers } from './data/ParticleData.ts'
import { PlayerBoundsData, type PlayerBoundsDataType } from './data/PlayerBoundsData.ts'
import { type ProjectileBuffers, ProjectileManagerData } from './data/ProjectileManagerData.ts'
import { type TileFrontBuffers, TileFrontData } from './data/TileFrontData.ts'
import { TunnelWeaponData, type TunnelWeaponDataType } from './data/TunnelWeaponData.ts'
import { VFXParticleData } from './data/VFXParticleData.ts'
import { VFXParticleOverflowData } from './data/VFXParticleOverflowData.ts'
import { VFXSettledTileData } from './data/VFXSettledTileData.ts'
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
  vfxSettledTile: SharedArrayBuffer
  vfxTileEffect: SharedArrayBuffer
  activateTiles: ActivateTilesBuffer

  tiles: SharedArrayBuffer
  fill: SharedArrayBuffer
  tileFront: TileFrontBuffers
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
  readonly activateTiles: ActivateTilesData
  readonly fill: Uint32Array
  readonly tileFront: TileFrontData

  static make(tilemap: Tilemap): DataManager {

    const { width, height } = tilemap
    const buffers: DataManagerBuffers = {
      chunkGrid: tilemap.chunkGrid.buffers,
      particle: ParticleData.makeBuffers(width, height),
      matterTankManager: MatterTankManagerData.makeBuffer(),
      playerBounds: PlayerBoundsData.makeBuffer(),
      projectileManager: ProjectileManagerData.makeBuffer(),
      tunnelWeapon: TunnelWeaponData.makeBuffer(),
      vfxParticleCreate: VFXParticleData.makeBuffer(),
      vfxParticleDestroy: VFXParticleData.makeBuffer(),
      vfxParticleOverflow: VFXParticleOverflowData.makeBuffer(),
      vfxSettledTile: VFXSettledTileData.makeBuffer(),
      vfxTileEffect: VFXTileEffectData.makeBuffer(),
      activateTiles: ActivateTilesData.makeBuffer(width, height),
      tiles: tilemap.buffers.tiles,
      fill: tilemap.buffers.fillLevels,
      tileFront: TileFrontData.makeBuffers(tilemap),
      width,
      height,
    }

    return new DataManager(buffers)
  }

  constructor(readonly buffers: DataManagerBuffers) {
    this.chunkGrid = new ChunkGrid(buffers.chunkGrid)
    this.particle = new ParticleData(buffers.particle)
    this.matterTankManager = new MatterTankManagerData(buffers.matterTankManager)
    this.playerBounds = PlayerBoundsData.fromBuffer(buffers.playerBounds)
    this.projectileManager = new ProjectileManagerData(buffers.projectileManager)
    this.tunnelWeapon = TunnelWeaponData.fromBuffer(buffers.tunnelWeapon)
    this.vfxParticleCreate = new VFXParticleData(buffers.vfxParticleCreate)
    this.vfxParticleDestroy = new VFXParticleData(buffers.vfxParticleDestroy)
    this.vfxParticleOverflow = new VFXParticleOverflowData(buffers.vfxParticleOverflow)
    this.vfxSettledTile = new VFXSettledTileData(buffers.vfxSettledTile)
    this.vfxTileEffect = new VFXTileEffectData(buffers.vfxTileEffect)
    this.activateTiles = new ActivateTilesData(buffers.activateTiles)
    this.fill = new Uint32Array(buffers.fill)
    this.tileFront = new TileFrontData(buffers.tileFront)
  }
}
