import { MAX_MATTER_TANKS } from '../../../config.ts'
import { type MatterTankId, PLAYER_MATTER_TANK_ID } from '../../Matter/Tank/_MatterTank.types.ts'
import { makeSOABuffers, type Schema, soaBuffersToViews } from '../../Util/StructOfArrays.ts'

// reservedDestroyPlaced + reservedDestroyInFlight together hold one reservation (a create-lava/
// acid beam's eventual destroy-charge liability), split across its two lifecycle phases because
// each phase is cheapest to track a different way:
//   - reservedDestroyInFlight covers tiles the beam hasn't painted yet. It's recomputed from
//     scratch every tick (cleared, then rebuilt from the bounded list of in-flight projectiles —
//     same mechanism as pendingCreate/pendingDestroy). Cheap because the projectile list is
//     small and bounded, and self-healing: if a beam is cut short, its contribution just stops
//     being recomputed, no explicit cleanup needed.
//   - reservedDestroyPlaced covers tiles that *have* been painted — actual lava/acid sitting on
//     the map, possibly thousands of ticks after the beam that created them is gone. There's no
//     bounded list of "live lava/acid tiles" to rescan every tick (that would mean walking the
//     whole tilemap), so this one has to be tracked incrementally instead: +amount once when a
//     tile is placed, -amount once when that specific tile is later destroyed.
// As a beam paints each tile, that tile's liability moves from one field to the other within the
// same tick (reservedDestroyInFlight shrinks by `amount`, reservedDestroyPlaced grows by `amount`)
// — the combined total (see MatterTank.reservedDestroy) never changes across that handoff.
const SCHEMA = {
  matter: Uint32Array,
  pendingCreate: Uint32Array,
  pendingDestroy: Uint32Array,
  reservedDestroyPlaced: Uint32Array,
  reservedDestroyInFlight: Uint32Array,
  overflow: Uint32Array,
  matterMax: Uint32Array,
} as const satisfies Schema

type MatterTankManagerSchema = typeof SCHEMA
export type MatterTankManagerBuffers = Record<keyof MatterTankManagerSchema, SharedArrayBuffer>

export class MatterTankManagerData {
  readonly matter: Uint32Array
  readonly pendingCreate: Uint32Array
  readonly pendingDestroy: Uint32Array
  // See the comment above SCHEMA for why this is split across two fields.
  readonly reservedDestroyPlaced: Uint32Array
  readonly reservedDestroyInFlight: Uint32Array
  readonly matterMax: Uint32Array
  readonly overflow: Uint32Array

  readonly buffers: MatterTankManagerBuffers
  // must start at 0 = no owner, 1 = player
  protected idIncrement = 2

  static makeBuffer(): MatterTankManagerBuffers {
    return makeSOABuffers(SCHEMA, MAX_MATTER_TANKS)
  }

  static fromBuffers(buffers: MatterTankManagerBuffers): MatterTankManagerData {
    return new MatterTankManagerData(buffers)
  }

  constructor(buffers: MatterTankManagerBuffers) {
    const views = soaBuffersToViews(SCHEMA, buffers)

    this.matter = views.matter
    this.pendingCreate = views.pendingCreate
    this.pendingDestroy = views.pendingDestroy
    this.reservedDestroyPlaced = views.reservedDestroyPlaced
    this.reservedDestroyInFlight = views.reservedDestroyInFlight
    this.matterMax = views.matterMax
    this.overflow = views.overflow
    this.buffers = buffers
  }

  registerPlayerMatterTank(matterMax: number, matter: number = 0) {
    const id = PLAYER_MATTER_TANK_ID
    this.create(id, matterMax, matter)

    return id
  }

  registerMatterTank(matterMax: number, matter: number = 0) {
    const id = this.idIncrement++ as MatterTankId

    this.create(id, matterMax, matter)

    return id
  }

  private create(id: MatterTankId, matterMax: number, matter: number = 0): void {
    this.setMatter(id, matter)
    this.setMatterMax(id, matterMax)
  }

  getMatter(id: MatterTankId): number {
    return this.matter[id]
  }

  getPendingCreate(id: MatterTankId): number {
    return this.pendingCreate[id]
  }

  getPendingDestroy(id: MatterTankId): number {
    return this.pendingDestroy[id]
  }

  getReservedDestroyPlaced(id: MatterTankId): number {
    return this.reservedDestroyPlaced[id]
  }

  getReservedDestroyInFlight(id: MatterTankId): number {
    return this.reservedDestroyInFlight[id]
  }

  getMatterMax(id: MatterTankId): number {
    return this.matterMax[id]
  }

  getOverflow(id: MatterTankId): number {
    return Atomics.load(this.overflow, id)
  }

  setMatter(id: MatterTankId, value: number): void {
    this.matter[id] = value
  }

  setPendingCreate(id: MatterTankId, value: number): void {
    this.pendingCreate[id] = value
  }

  setPendingDestroy(id: MatterTankId, value: number): void {
    this.pendingDestroy[id] = value
  }

  setReservedDestroyPlaced(id: MatterTankId, value: number): void {
    this.reservedDestroyPlaced[id] = value
  }

  setReservedDestroyInFlight(id: MatterTankId, value: number): void {
    this.reservedDestroyInFlight[id] = value
  }

  setMatterMax(id: MatterTankId, value: number): void {
    this.matterMax[id] = value
  }

  setOverflow(id: MatterTankId, overflowId: number): void {
    Atomics.store(this.overflow, id, overflowId)
  }
}
