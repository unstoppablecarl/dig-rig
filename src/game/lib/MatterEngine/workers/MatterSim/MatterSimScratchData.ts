import { type Buffers, makeSOABuffers, type Schema, soaBuffersToViews } from '../../../Util/StructOfArrays.ts'

const SCHEMA = {
  indices: Int32Array,
  next: Int32Array,
  vfxJustSettled: Int32Array,
  structuralRemovals: Int32Array,
} as const satisfies Schema

export type SimScratchSchema = typeof SCHEMA
export type SimScratchBuffers = Buffers<SimScratchSchema>

// Generous fixed capacity for each scratch array — comfortably above
// anything measured so far (worst-case per-round batches have been in the
// low thousands; a ~200k-tile whole-map stress test still left plenty of
// margin below this even in a single worker's share). Overflow is handled
// gracefully (clamp + warn) rather than assumed impossible, so this is a
// performance tuning knob, not a correctness cliff edge.
export const SIM_SCRATCH_CAPACITY = 262_144

// Per-worker shared scratch space for the Coordinator <-> MatterSim worker
// message protocol. Both sides construct one of these from the same
// SimScratchBuffers (coordinator creates it via makeBuffers(), the worker
// rebuilds views from the buffers handed to it over the INIT message) and
// read/write the shared Int32Arrays directly instead of passing indices/
// next/vfxJustSettled/structuralRemovals as postMessage array payloads —
// avoids a structured-clone of what can be a many-thousand-entry array on
// every dispatch round.
export class MatterSimScratchData {
  readonly indices: Int32Array
  readonly next: Int32Array
  readonly vfxJustSettled: Int32Array
  readonly structuralRemovals: Int32Array

  static makeBuffers(): SimScratchBuffers {
    return makeSOABuffers(SCHEMA, SIM_SCRATCH_CAPACITY)
  }

  constructor(readonly buffers: SimScratchBuffers) {
    const views = soaBuffersToViews(SCHEMA, buffers)

    this.indices = views.indices
    this.next = views.next
    this.vfxJustSettled = views.vfxJustSettled
    this.structuralRemovals = views.structuralRemovals
  }
}
