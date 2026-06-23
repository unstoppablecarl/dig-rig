/// <reference lib="webworker" />
import { matterType, type MatterType } from '../../../Matter/_Matter.types.ts'
import { SETTLING_TYPES } from '../../../Matter/matter.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import { type ProjectileManagerData, ProjectileStatus } from '../../data/ProjectileManagerData.ts'
import type { VFXParticleData } from '../../data/VFXParticleData.ts'
import type { VFXTileEffectData } from '../../data/VFXTileEffectData.ts'
import type { Effects } from './Effects.ts'
import type { SimMatterTanks } from './SimMatterTanks.ts'

export class ProjectileProcessor {
  constructor(
    private readonly projectileData: ProjectileManagerData,
    private readonly tileEffectData: VFXTileEffectData,
    private readonly effects: Effects,
    private readonly matterTanks: SimMatterTanks,
    private readonly vfxParticleDestroyData: VFXParticleData,
    private readonly vfxParticleCreateData: VFXParticleData,
  ) {
  }

  hasWork(): boolean {
    for (let i = 0; i < this.projectileData.status.length; i++) {
      if (this.projectileData.status[i] !== ProjectileStatus.INACTIVE) return true
    }
    return false
  }

  step(activeSet: Set<number>, dirtyChunks: Set<number>): boolean {
    let structuralDirty = false
    const d = this.projectileData

    for (let i = 0; i < d.status.length; i++) {
      if (!d.isActive(i)) continue
      const { tiles, structuralDirty: pDirty } = this.effects.processProjectileSlot(i, d, activeSet, dirtyChunks)
      structuralDirty ||= pDirty
      const modified = tiles.length
      if (!modified) continue

      const ownerId = d.ownerId[i] as MatterTankId

      const mode = d.mode[i] as FireMode
      if (mode === FireMode.DESTROY) {
        this.matterTanks.add(ownerId, modified)
        this.vfxParticleDestroyData.writeTiles(tiles, ownerId)
        this.tileEffectData.writeFireModeTiles(tiles, mode)

      } else if (mode === FireMode.CREATE) {
        this.matterTanks.remove(ownerId, modified)
        const createType = d.createType[i] as MatterType
        if (!SETTLING_TYPES.has(matterType(createType))) {
          this.tileEffectData.writeFireModeTiles(tiles, mode)
          this.vfxParticleCreateData.writeTiles(tiles, ownerId)
        }

      } else {
        this.tileEffectData.writeFireModeTiles(tiles, mode)
      }

    }
    this._recomputePending()
    return structuralDirty
  }

  private _recomputePending() {
    this.matterTanks.clearPending()
    const d = this.projectileData

    for (let i = 0; i < d.status.length; i++) {
      if (d.status[i] === ProjectileStatus.INACTIVE) continue
      const mode = d.mode[i] as FireMode
      if (mode !== FireMode.CREATE && mode !== FireMode.DESTROY) continue
      const remaining = d.tilesToModify[i] - d.tilesModified[i]
      if (remaining < 0) throw new Error('should not be negative')
      if (remaining === 0) continue
      const ownerId = d.ownerId[i] as MatterTankId
      this.matterTanks.addPendingCharge(ownerId, mode, remaining)
    }
  }
}
