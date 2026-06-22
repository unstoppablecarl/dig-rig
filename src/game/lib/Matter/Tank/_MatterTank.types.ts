import type { MatterExchanger, ParticleTarget, Position } from '../../../types.ts'

export type MatterTankId = number & { readonly __brandMatterTankId: unique symbol; }
export type MatterTankSource = (MatterExchanger | Position) & ParticleTarget

export const NO_MATTER_TANK_ID = 0 as MatterTankId
export const PLAYER_MATTER_TANK_ID = 1 as MatterTankId
