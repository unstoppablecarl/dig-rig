import { makeStructFactory } from '../../Util/Struct.ts'

export type PlayerBoundsDataType = ReturnType<typeof PlayerBoundsData.make>
export type PlayerBounds = {
  left: number
  right: number
  top: number
  bottom: number
}

export const EMPTY_PLAYER_BOUNDS: PlayerBounds = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
} as const
// should only be mutated from outside of worker
// should only be read from inside worker
export const PlayerBoundsData = makeStructFactory({
  left: Float32Array,
  right: Float32Array,
  top: Float32Array,
  bottom: Float32Array,
})
