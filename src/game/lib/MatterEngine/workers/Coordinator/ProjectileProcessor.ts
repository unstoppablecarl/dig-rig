/// <reference lib="webworker" />
import { FILL_MAX } from '../../../Matter/_Liquid.constants.ts'
import { matterType, type MatterType } from '../../../Matter/_Matter.types.ts'
import { doesSettle, getReserveDestroyAmount, isLiquid } from '../../../Matter/matter.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import { FireMode } from '../../../Player/_FireMode-types.ts'
import { type ProjectileManagerData, ProjectileShape, ProjectileStatus } from '../../data/ProjectileManagerData.ts'
import type { VFXParticleData } from '../../data/VFXParticleData.ts'
import type { VFXTileEffectData } from '../../data/VFXTileEffectData.ts'
import type { ConservationTracker } from './ConservationTracker.ts'
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
    private readonly tracker: ConservationTracker,
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
      const result = this.effects.processProjectileSlot(i, d, activeSet, dirtyChunks)
      structuralDirty ||= result.structuralDirty
      // Track tile-domain changes in unified fill units (1 solid = FILL_MAX).
      this.tracker.addDelta(result.solidDomainDelta * FILL_MAX + result.liquidDomainDelta)
      const tiles = result.tiles
      const modified = tiles.length
      if (!modified) continue

      const ownerId = d.ownerId[i] as MatterTankId

      const mode = d.mode[i] as FireMode
      if (mode === FireMode.DESTROY) {
        // Liquid tiles → liquidMatter (fill units). Solid/fire tiles → solid tank (FILL_MAX each).
        const liquidFill = -result.liquidDomainDelta   // fill units destroyed (non-negative)
        const nonLiquidCount = modified - result.prevLiquidTiles

        if (liquidFill > 0) {
          this.matterTanks.addLiquidMatter(ownerId, liquidFill)
          this.tracker.addDelta(liquidFill)  // cancels top -liquidFill
        }
        if (nonLiquidCount > 0) {
          this.matterTanks.add(ownerId, nonLiquidCount)
          this.tracker.addDelta(nonLiquidCount * FILL_MAX)  // solid tank grew
        }

        this.vfxParticleDestroyData.writeTiles(tiles, ownerId)
        this.tileEffectData.writeFireModeTiles(tiles, mode)

      } else if (mode === FireMode.CREATE) {
        const createType = d.createType[i] as MatterType
        const createMatterType = matterType(createType)

        if (isLiquid(createMatterType)) {
          // Liquid create: debit liquidMatter; falls back to solid tank for any shortfall.
          const liquidNeeded = result.liquidDomainDelta  // = modified * FILL_MAX (positive)
          this.matterTanks.removeLiquidMatter(ownerId, liquidNeeded)
          // In unified fill units, any funding source cancels the top +liquidNeeded exactly.
          // (solidConsumed solid units = solidConsumed*FILL_MAX fill; the shortfall remainder
          //  came from liquidMatter — together they sum to liquidNeeded.)
          this.tracker.addDelta(-liquidNeeded)
        } else {
          // Solid create: debit solid tank.
          this.matterTanks.remove(ownerId, modified)
          this.tracker.addDelta(-modified * FILL_MAX)
        }

        const reserveAmount = getReserveDestroyAmount(createMatterType)
        if (reserveAmount > 0) {
          this.matterTanks.reserveDestroyCharge(ownerId, reserveAmount * modified, 'create')
        }
        if (!doesSettle(createMatterType)) {
          this.tileEffectData.writeFireModeTiles(tiles, mode)
          // Flood-fill creates can paint far from the collision point, so anchor the VFX
          // source on where the projectile hit rather than the tank's emit position.
          const srcPos = d.shape[i] === ProjectileShape.FLOOD_FILL
            ? { x: d.tileX[i], y: d.tileY[i] }
            : undefined
          this.vfxParticleCreateData.writeTiles(tiles, ownerId, srcPos)
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

      // Future destroy-liability for tiles this CREATE projectile hasn't painted yet — without
      // this, a beam that travels for several ticks before hitting anything would leave its
      // eventual lava/acid reservation unaccounted for, letting a second beam fired in the
      // meantime be cleared against the same unreserved destroy headroom. Tracked as reserved
      // (not pending) since it's the same liability as reserveDestroyCharge, just not yet settled.
      if (mode === FireMode.CREATE) {
        const reserveAmount = getReserveDestroyAmount(matterType(d.createType[i] as MatterType))
        if (reserveAmount > 0) {
          this.matterTanks.addReservedDestroyInFlight(ownerId, reserveAmount * remaining)
        }
      }
    }
  }
}
