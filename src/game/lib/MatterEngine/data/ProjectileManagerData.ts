import { MAX_PROJECTILES } from '../../../config.ts'
import { MatterType } from '../../Matter/_Matter.types.ts'
import type { BaseProjectile } from '../../Projectiles/BaseProjectile.ts'
import { type Buffers, makeSOABuffers, type Schema, soaBuffersToViews } from '../../Util/StructOfArrays.ts'

const SCHEMA = {
  status: Uint8Array,
  mode: Uint8Array,
  tileX: Uint32Array,
  tileY: Uint32Array,
  radius: Uint32Array,
  innerRadius: Uint32Array,
  tilesToModify: Uint32Array,
  ownerId: Uint32Array,
  createType: Uint32Array,
  tilesModified: Uint32Array,  // coordinator sole writer
} as const satisfies Schema

export type ProjectileSchema = typeof SCHEMA
export type ProjectileBuffers = Record<keyof ProjectileSchema, SharedArrayBuffer>

export enum ProjectileStatus {
  INACTIVE,
  ACTIVE,
  PENDING,
}

export class ProjectileManagerData {
  readonly status: Uint8Array
  readonly mode: Uint8Array
  readonly tileX: Uint32Array
  readonly tileY: Uint32Array
  readonly radius: Uint32Array
  readonly innerRadius: Uint32Array
  readonly tilesToModify: Uint32Array
  readonly ownerId: Uint32Array
  readonly createType: Uint32Array
  readonly tilesModified: Uint32Array

  readonly buffers: ProjectileBuffers

  private readonly _freeSlots: number[] = Array.from({ length: MAX_PROJECTILES }, (_, i) => i)

  static makeBuffer(): ProjectileBuffers {
    return makeSOABuffers(SCHEMA, MAX_PROJECTILES)
  }

  constructor(buffers: Buffers<ProjectileSchema>) {
    const views = soaBuffersToViews(SCHEMA, buffers)

    this.status = views.status
    this.mode = views.mode
    this.tileX = views.tileX
    this.tileY = views.tileY
    this.radius = views.radius
    this.innerRadius = views.innerRadius
    this.tilesToModify = views.tilesToModify
    this.tilesModified = views.tilesModified
    this.ownerId = views.ownerId
    this.createType = views.createType

    this.buffers = buffers
  }

  acquire(): number {
    return this._freeSlots.pop() ?? -1
  }

  release(slotIdx: number) {
    if (slotIdx < 0) return
    if (this.status[slotIdx] === ProjectileStatus.INACTIVE) {
      console.error(`ProjectileManagerData: double-release of slot ${slotIdx}`)
      return
    }
    this.status[slotIdx] = ProjectileStatus.INACTIVE
    this.tilesModified[slotIdx] = 0
    this._freeSlots.push(slotIdx)
  }

  // Mark slot as pending-only (active=ProjectileStatus.PENDING): counted in _recomputePending but not processed.
  // Call immediately on projectile creation so pendingCreate is correct before first sync().
  registerPending(p: BaseProjectile) {
    const idx = p.slotIdx
    this.tilesToModify[idx] = p.tilesToModify
    this.ownerId[idx] = p.matterTank.id
    this.mode[idx] = p.effect.mode
    this.status[idx] = ProjectileStatus.PENDING
  }

  syncFromProjectile(p: BaseProjectile, innerRadius = 0, tilesToModify?: number) {
    const idx = p.slotIdx
    this.tileX[idx] = Math.round(p.x)
    this.tileY[idx] = Math.round(p.y)
    this.radius[idx] = Math.round(p.radius)
    this.innerRadius[idx] = innerRadius
    this.tilesToModify[idx] = tilesToModify ?? p.tilesToModify
    this.ownerId[idx] = p.matterTank.id
    this.mode[idx] = p.effect.mode
    this.createType[idx] = (p.effect.createType ?? MatterType.SOLID)
    this.status[idx] = ProjectileStatus.ACTIVE
  }

  isActive(idx: number) {
    return this.status[idx] === ProjectileStatus.ACTIVE
  }
}
