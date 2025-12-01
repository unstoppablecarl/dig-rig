import { makeBitmaskIncrementer } from '../../helpers/_helpers.ts'

const incrementMask = makeBitmaskIncrementer()

export const MASK_PLAYER = incrementMask()
export const MASK_TERRAIN = incrementMask()
