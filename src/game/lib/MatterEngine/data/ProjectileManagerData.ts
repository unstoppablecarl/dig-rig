import { MAX_PROJECTILES } from '../../../config.ts'
import { MatterType } from '../../Matter/_Matter.types.ts'
import type { BaseProjectile } from '../../Projectiles/BaseProjectile.ts'
import { type Buffers, makeSOABuffers, type Schema, soaBuffersToViews } from '../../Util/StructOfArrays.ts'

const SCHEMA = {
  active: Uint8Array,
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

export class ProjectileManagerData {
  readonly active: Uint8Array
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

  static make(): ProjectileManagerData {
    const buffers = makeSOABuffers(SCHEMA, MAX_PROJECTILES)
    return new ProjectileManagerData(buffers)
  }

  constructor(buffers: Buffers<ProjectileSchema>) {
    const views = soaBuffersToViews(SCHEMA, buffers)

    this.active = views.active
    this.mode = views.mode
    this.tileX = views.tileX
    this.tileY = views.tileY
    this.radius = views.radius
    this.innerRadius = views.innerRadius
    this.tilesToModify = views.tilesToModify
    this.ownerId = views.ownerId
    this.createType = views.createType
    this.tilesModified = views.tilesModified

    this.buffers = buffers
  }

  acquire(): number {
    return this._freeSlots.pop() ?? -1
  }

  release(slotIdx: number) {
    if (slotIdx < 0) return
    if (this.active[slotIdx] === 0) {
      console.error(`ProjectileManagerData: double-release of slot ${slotIdx}`)
      return
    }
    this.active[slotIdx] = 0
    this.tilesModified[slotIdx] = 0
    this._freeSlots.push(slotIdx)
  }

  // Mark slot as pending-only (active=2): counted in _recomputePending but not processed.
  // Call immediately on projectile creation so pendingCreate is correct before first sync().
  registerPending(p: BaseProjectile) {
    const idx = p.slotIdx
    this.tilesToModify[idx] = p.tilesToModify
    this.ownerId[idx] = p.matterTank.id as unknown as number
    this.mode[idx] = p.effect.mode as unknown as number
    this.active[idx] = 2
  }

  syncFromProjectile(p: BaseProjectile, innerRadius = 0) {
    const idx = p.slotIdx
    this.tileX[idx] = Math.round(p.x)
    this.tileY[idx] = Math.round(p.y)
    this.radius[idx] = Math.round(p.radius)
    this.innerRadius[idx] = innerRadius
    this.tilesToModify[idx] = p.tilesToModify
    this.ownerId[idx] = p.matterTank.id as unknown as number
    this.mode[idx] = p.effect.mode as unknown as number
    this.createType[idx] = (p.effect.createType ?? MatterType.SOLID) as unknown as number
    this.active[idx] = 1
  }
}
