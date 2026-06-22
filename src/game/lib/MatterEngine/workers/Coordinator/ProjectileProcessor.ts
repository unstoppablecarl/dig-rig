/// <reference lib="webworker" />
import { matterType, type MatterType } from '../../../Matter/_Matter.types.ts'
import { SETTLING_TYPES } from '../../../Matter/matter.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import type { ProjectileManagerData } from '../../data/ProjectileManagerData.ts'
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
    // private readonly matterManagerData: MatterManagerData,
    private readonly vfxParticleDestroyData: VFXParticleData,
    private readonly vfxParticleCreateData: VFXParticleData,
  ) {
  }

  hasWork(): boolean {
    for (let i = 0; i < this.projectileData.active.length; i++) {
      if (this.projectileData.active[i] !== 0) return true
    }
    return false
  }

  step(activeSet: Set<number>, dirtyChunks: Set<number>): boolean {
    let structuralDirty = false
    for (let i = 0; i < this.projectileData.active.length; i++) {
      if (this.projectileData.active[i] !== 1) continue
      const { tiles, structuralDirty: pDirty } = this.effects.processProjectileSlot(
        i, this.projectileData, activeSet, dirtyChunks,
      )
      structuralDirty ||= pDirty
      if (tiles.length > 0) {
        const mode = this.projectileData.mode[i] as FireMode
        const ownerId = this.projectileData.ownerId[i] as MatterTankId
        const tank = this.matterTanks.getTank(ownerId)
        if (!tank) throw new Error(`matter tank not found: ${ownerId}`)

        if (mode === FireMode.DESTROY) {
          tank.add(tiles.length)
          this.vfxParticleDestroyData.writeTiles(tiles, ownerId)
        } else if (mode === FireMode.CREATE) {
          tank.remove(tiles.length)
          this.vfxParticleCreateData.writeTiles(tiles, ownerId)
        }

        if (mode === FireMode.CREATE) {
          const createType = this.projectileData.createType[i] as MatterType
          if (SETTLING_TYPES.has(matterType(createType))) {
            this.tileEffectData.writeFireModeTiles(tiles, mode)
          }
        } else {
          this.tileEffectData.writeFireModeTiles(tiles, mode)
        }
      }
    }
    this._recomputePending()
    return structuralDirty
  }

  private _recomputePending() {
    this.matterTanks.clearPending()

    for (let i = 0; i < this.projectileData.active.length; i++) {
      if (this.projectileData.active[i] === 0) continue
      const mode = this.projectileData.mode[i] as FireMode
      if (mode !== FireMode.CREATE && mode !== FireMode.DESTROY) continue
      const remaining = this.projectileData.tilesToModify[i] - this.projectileData.tilesModified[i]
      if (remaining < 0) throw new Error('should not be negative')
      if (remaining === 0) continue
      const ownerId = this.projectileData.ownerId[i] as MatterTankId
      this.matterTanks.addPendingCharge(ownerId, mode, remaining)
    }
  }
}
