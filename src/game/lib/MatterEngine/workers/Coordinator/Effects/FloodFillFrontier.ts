/// <reference lib="webworker" />

type Frontier = {
  seedIdx: number
  seedX: number
  seedY: number
  width: number
  heap: number[]
  visited: Set<number>
}

// Persists a closest-first frontier per projectile slot so a flood fill can keep expanding
// across multiple worker ticks, and so an unobstructed fill reads as a roughly circular blob
// instead of the diamond a plain FIFO (Manhattan-distance) BFS produces. Ordering the frontier
// by straight-line distance to the seed approximates a uniform-cost search: it still only
// flows through tiles connected via `passes`, but always expands into the geometrically
// closest unvisited tile next, rather than whichever was discovered first.
//
// Persistence matters because the seed tile itself gets converted on the first tick, so
// re-testing `passes(seedIdx)` on a later tick would no longer find it and the fill would
// appear to stop dead at the seed instead of continuing to expand.
export class FloodFillFrontier {
  private readonly bySlot = new Map<number, Frontier>()

  collect(
    slotIdx: number,
    seedIdx: number,
    budget: number,
    width: number,
    height: number,
    passes: (idx: number) => boolean,
    extraSeeds: number[] = [],
  ): number[] {
    let frontier = this.bySlot.get(slotIdx)
    if (!frontier || frontier.seedIdx !== seedIdx) {
      frontier = {
        seedIdx,
        seedX: seedIdx % width,
        seedY: (seedIdx / width) | 0,
        width,
        heap: [],
        visited: new Set([seedIdx]),
      }
      this.bySlot.set(slotIdx, frontier)
      if (passes(seedIdx)) this._push(frontier, seedIdx)
      for (const extra of extraSeeds) {
        if (extra < 0 || frontier.visited.has(extra)) continue
        frontier.visited.add(extra)
        if (passes(extra)) this._push(frontier, extra)
      }
    }

    const result: number[] = []
    while (result.length < budget && frontier.heap.length > 0) {
      const idx = this._pop(frontier)
      result.push(idx)

      const x = idx % width
      const y = (idx / width) | 0
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ]
      for (const n of neighbors) {
        if (n < 0 || frontier.visited.has(n)) continue
        frontier.visited.add(n)
        if (passes(n)) this._push(frontier, n)
      }
    }

    return result
  }

  private _dist2(frontier: Frontier, idx: number): number {
    const dx = (idx % frontier.width) - frontier.seedX
    const dy = ((idx / frontier.width) | 0) - frontier.seedY
    return dx * dx + dy * dy
  }

  private _push(frontier: Frontier, idx: number) {
    const heap = frontier.heap
    heap.push(idx)
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this._dist2(frontier, heap[parent]) <= this._dist2(frontier, heap[i])) break
      ;[heap[parent], heap[i]] = [heap[i], heap[parent]]
      i = parent
    }
  }

  private _pop(frontier: Frontier): number {
    const heap = frontier.heap
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length > 0) {
      heap[0] = last
      let i = 0
      const n = heap.length
      for (;;) {
        const l = i * 2 + 1
        const r = i * 2 + 2
        let smallest = i
        if (l < n && this._dist2(frontier, heap[l]) < this._dist2(frontier, heap[smallest])) smallest = l
        if (r < n && this._dist2(frontier, heap[r]) < this._dist2(frontier, heap[smallest])) smallest = r
        if (smallest === i) break
        ;[heap[i], heap[smallest]] = [heap[smallest], heap[i]]
        i = smallest
      }
    }
    return top
  }
}
