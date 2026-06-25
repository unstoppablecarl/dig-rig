import { VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE } from '../../../config.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import type { MatterTank } from '../../Matter/Tank/MatterTank.ts'
import { VFXParticleData } from '../data/VFXParticleData.ts'
import type { VFXParticleOverflowData } from '../data/VFXParticleOverflowData.ts'

export class VFXParticleProcessor {
  private readonly _destroyChunks = new Set<number>()
  private readonly _createChunks = new Set<number>()

  constructor(
    private readonly scene: GameLevel,
    private readonly overflow: VFXParticleOverflowData,
    readonly vfxParticleDestroyData: VFXParticleData,
    readonly vfxParticleCreateData: VFXParticleData,
  ) {
  }

  drain() {
    const { matterManager, vfxParticleManager } = this.scene
    this._drainBuffer(this.vfxParticleDestroyData, this._destroyChunks, (chunkPos, tank) => {
      vfxParticleManager.spawnMatter(chunkPos, tank.source, false)
    })
    this._drainBuffer(this.vfxParticleCreateData, this._createChunks, (chunkPos, tank, srcPos) => {
      vfxParticleManager.spawnMatter(srcPos ?? tank.getEmitPos(), chunkPos, true)
    })
    this.overflow.drain((from, to, amount) => {
      const fromTank = matterManager.get(from)
      const toTank = matterManager.get(to)
      if (!fromTank || !toTank) {
        console.warn(`MatterEngineVFXParticle: overflow tank not found (from=${from}, to=${to})`)
        return
      }
      vfxParticleManager.spawnMatterTankTransfer(amount, fromTank.getEmitPos(), toTank.source)
    })
  }

  // Spawns at most one particle per (ownerId, chunk) pair.
  // Key packs (ownerId << 22) | (cy << 11) | cx; valid for maps up to 4096 tiles wide.
  private _drainBuffer(
    data: VFXParticleData,
    spawnedChunks: Set<number>,
    spawn: (chunkPos: { x: number; y: number }, tank: MatterTank, srcPos?: { x: number; y: number }) => void,
  ) {
    spawnedChunks.clear()
    data.drain((tx, ty, ownerId, srcPos) => {
      const tank = this.scene.matterManager.get(ownerId as MatterTankId)
      if (!tank) {
        console.error('vfx particle tank not found: ', ownerId)
        return
      }
      const cx = Math.floor(tx / VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE)
      const cy = Math.floor(ty / VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE)
      const key = (ownerId << 22) | (cy << 11) | cx
      if (spawnedChunks.has(key)) return
      spawnedChunks.add(key)
      spawn(
        {
          x: (cx + 0.5) * VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE,
          y: (cy + 0.5) * VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE,
        },
        tank,
        srcPos,
      )
    })
  }
}
