import { type MatterType } from '../../Matter/_Matter.types.ts'
import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import type { DataManagerBuffers } from '../DataManager.ts'

export enum CoordinatorInMsg {
  INIT,
  BRUSH_ERASE_MATTER,
  BRUSH_ADD_MATTER,
}

export type CoordinatorInMsgInit = {
  type: CoordinatorInMsg.INIT
} & DataManagerBuffers

export type CoordinatorInMsgBrushEraseMatter = {
  type: CoordinatorInMsg.BRUSH_ERASE_MATTER
  tx: number
  ty: number
  radius: number
  ownerId: MatterTankId
}

export type CoordinatorInMsgAddBrushMatter = {
  type: CoordinatorInMsg.BRUSH_ADD_MATTER
  value: MatterType
  tx: number
  ty: number
  radius: number
}

export type CoordinatorInMessage =
  | CoordinatorInMsgInit
  | CoordinatorInMsgAddBrushMatter
  | CoordinatorInMsgBrushEraseMatter

export type TypedMatterCoordinatorWorker = Omit<Worker, 'postMessage'> & {
  postMessage(msg: CoordinatorInMessage): void
}
