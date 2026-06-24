/// <reference lib="webworker" />
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'

export type MatterMutationLabel =
  | 'create'
  | 'external-overwrite'
  | 'self-destruct'

export type MatterMutationKind = 'reserve' | 'release'

export type MatterMutationEntry = {
  frame: number
  ownerId: MatterTankId
  kind: MatterMutationKind
  amount: number
  resultingValue: number
  label: MatterMutationLabel
}

const CAPACITY = 256

// Coordinator-thread-only diagnostics, gated behind ENABLE_MATTER_TANK_DEBUG —
// plain JS circular buffer, no cross-thread plumbing needed since all
// reserve/release calls already happen on the Coordinator thread.
export class MatterMutationLog {
  private readonly entries: MatterMutationEntry[] = []
  private cursor = 0

  push(entry: MatterMutationEntry) {
    if (this.entries.length < CAPACITY) {
      this.entries.push(entry)
    } else {
      this.entries[this.cursor] = entry
      this.cursor = (this.cursor + 1) % CAPACITY
    }
  }

  recent(n: number): MatterMutationEntry[] {
    const len = this.entries.length
    const count = Math.min(n, len)
    const out: MatterMutationEntry[] = []
    for (let i = 0; i < count; i++) {
      out.push(this.entries[(this.cursor - count + i + len) % len])
    }
    return out
  }
}
