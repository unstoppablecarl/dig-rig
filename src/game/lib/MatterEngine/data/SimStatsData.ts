import { makeStructFactory } from '../../Util/Struct.ts'

export type SimStatsDataType = ReturnType<typeof SimStatsData.make>

// should only be mutated from inside the worker
// should only be read from outside the worker
export const SimStatsData = makeStructFactory({
  stepCount: Int32Array,
})
