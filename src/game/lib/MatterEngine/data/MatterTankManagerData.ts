import { type MatterTankId, PLAYER_MATTER_TANK_ID } from '../../Matter/Tank/_MatterTank.types.ts'
import { makeSOABuffers, type Schema, soaBuffersToViews } from '../../Util/StructOfArrays.ts'

export const MAX_MATTER_TANKS = 64

const SCHEMA = {
  matter: Uint32Array,
  pendingCreate: Uint32Array,
  pendingDestroy: Uint32Array,
  overflow: Uint32Array,
  matterMax: Uint32Array,
} as const satisfies Schema

type MatterTankManagerSchema = typeof SCHEMA
export type MatterTankManagerBuffers = Record<keyof MatterTankManagerSchema, SharedArrayBuffer>

export class MatterTankManagerData {
  readonly matter: Uint32Array
  readonly pendingCreate: Uint32Array
  readonly pendingDestroy: Uint32Array
  readonly matterMax: Uint32Array
  readonly overflow: Uint32Array

  readonly buffers: MatterTankManagerBuffers
  // must start at 0 = no owner, 1 = player
  protected idIncrement = 2

  static makeBuffer(): MatterTankManagerBuffers {
    return makeSOABuffers(SCHEMA, MAX_MATTER_TANKS)
  }

  static make(): MatterTankManagerData {
    const buffers = MatterTankManagerData.makeBuffer()
    return new MatterTankManagerData(buffers)
  }

  static fromBuffers(buffers: MatterTankManagerBuffers): MatterTankManagerData {
    return new MatterTankManagerData(buffers)
  }

  constructor(buffers: MatterTankManagerBuffers) {
    const views = soaBuffersToViews(SCHEMA, buffers)

    this.matter = views.matter
    this.pendingCreate = views.pendingCreate
    this.pendingDestroy = views.pendingDestroy
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

  setMatterMax(id: MatterTankId, value: number): void {
    this.matterMax[id] = value
  }

  setOverflow(id: MatterTankId, overflowId: number): void {
    Atomics.store(this.overflow, id, overflowId)
  }
}
