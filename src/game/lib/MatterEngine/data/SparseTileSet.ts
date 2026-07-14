// Minimal shape shared with the built-in Set<number> (add/has/clear/size/
// iteration) — anything already typed against this (or a plain Set<number>,
// which structurally satisfies it) works with either implementation without
// further changes. Only the specific activeSet/idleSet call chain needs to
// actually switch to SparseTileSet below; MatterSim's worker-local `next`
// (a plain Set<number>) is passed into the same generic functions and needs
// no changes at all.
export interface TileSet {
  add(idx: number): void
  has(idx: number): boolean
  clear(): void
  readonly size: number
  [Symbol.iterator](): IterableIterator<number>
}

// Sparse set over a bounded integer domain [0, capacity) — used for the
// Coordinator's activeSet/idleSet swap, which sees up to ~200k add() calls
// per step. A JS Set<number> hashes every insertion; this does one
// typed-array write per add/has/clear instead, and iteration is a direct
// scan of a dense array rather than the Set iterator protocol.
//
// Standard two-array sparse-set trick: `dense` holds the active indices in
// insertion order; `sparse[idx]` holds idx's position in `dense`. An idx is
// a member iff `sparse[idx] < count && dense[sparse[idx]] === idx` — this
// check tolerates `sparse` never being cleared (stale entries just fail the
// bounds/identity check), so clear() is O(1).
export class SparseTileSet implements TileSet {
  private readonly dense: Uint32Array
  private readonly sparse: Uint32Array
  private count = 0

  constructor(capacity: number) {
    this.dense = new Uint32Array(capacity)
    this.sparse = new Uint32Array(capacity)
  }

  get size(): number {
    return this.count
  }

  has(idx: number): boolean {
    const denseIdx = this.sparse[idx]
    return denseIdx < this.count && this.dense[denseIdx] === idx
  }

  add(idx: number): void {
    if (this.has(idx)) return
    this.sparse[idx] = this.count
    this.dense[this.count] = idx
    this.count++
  }

  clear(): void {
    this.count = 0
  }

  [Symbol.iterator](): IterableIterator<number> {
    return this.dense.subarray(0, this.count)[Symbol.iterator]()
  }
}
