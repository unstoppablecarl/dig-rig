# Workers

The matter simulation runs across three thread contexts: the main thread, a coordinator worker, and a pool of sim workers. All three share the same `SharedArrayBuffer` tile data — no copying between threads.

## Thread layout

```
Main thread
  └─ CoordinatorController      postMessage  →  Coordinator worker
                                               (Coordinator.ts)
                                                ├─ SimWorkerPool
                                                │   ├─ MatterSimController → MatterSim worker 0
                                                │   ├─ MatterSimController → MatterSim worker 1
                                                │   └─ ... (hardwareConcurrency - 2 workers)
                                                └─ ParticleSim (runs on coordinator thread)
```

**Pool size**: `Math.max(1, navigator.hardwareConcurrency - 2)` — leaves one core for the main thread and one for the coordinator.

## Shared memory

All workers attach views to the same SABs on `INIT`:

| SAB | View type | Purpose |
|-----|-----------|---------|
| `tilesBuffer` | `Uint32Array` | Per-tile matter state (type, settled bit, owner, counter) |
| `fillBuffer` | `Float32Array` | Per-tile liquid fill level |
| `chunkGrid.*` | various | Per-chunk dirty gens, solid counts, anchored flags |

Workers write directly to these buffers. The main thread reads them for rendering. No message-passing for tile data.

## Coordinator loop

`Coordinator.worker.ts` drives a self-scheduling loop:

```
setTimeout(step, 8ms) → step() → setTimeout(step, 8ms) → ...
```

Each `step()`:
1. Drain pending activations from physics/projectiles/brush into the active set.
2. Snapshot the active set (swap active ↔ idle sets so new activations during the step land in the fresh set).
3. Run brush and projectile mutations directly (single-threaded, before workers see the tiles).
4. `await workerPool.step(snapshot, ...)` — dispatches the CA rounds (see below).
5. Collect `r.next` from all worker results into the new active set.
6. Run `sim.doUpwardPressurePass()` on the coordinator's own `MatterSim` instance — safe because all worker rounds are done.
7. Run structural/physics checks.
8. Run `particleSim.step()` on the coordinator thread.

## 4-round chunk checkerboard

The active tile set is divided into four rounds based on each tile's chunk position. This is the same pattern used by Noita's "Falling Everything" engine: chunks in the same round are never adjacent, so workers processing them in parallel can never write to the same cell or each other's neighbouring cells.

Every step covers every chunk — each position belongs to exactly one of the four types and is processed in that type's round:

```
A B A B A B   ← all processed in one step (rounds A, B, C, D run sequentially)
C D C D C D
A B A B A B
C D C D C D
```

The per-round diagrams below show which chunks run *in parallel within that round*. The dots are not gaps — they are chunks handled by the other rounds.

```
round 0 (A): [ A . A . ]   cx even, cy even — processed concurrently
round 1 (B): [ . B . B ]   cx odd,  cy even — processed concurrently
round 2 (C): [ C . C . ]   cx even, cy odd  — processed concurrently
round 3 (D): [ . D . D ]   cx odd,  cy odd  — processed concurrently

formula: (cx & 1) | ((cy & 1) << 1)  →  0=A  1=B  2=C  3=D
```

`CHUNK_SIZE = 64`. CA elements move at most 1 tile per step, so a tile can never reach another chunk of the same type in a single round — the nearest same-type chunk is always 2 chunks (128 tiles) away.

### Round processing order: C, D, A, B

Rounds run sequentially with `await Promise.all` between each. The order is **C → D → A → B** (rounds 2, 3, 0, 1), not the natural 0–3 order.

C and D chunks have `cy % 2 === 1` — they occupy the lower screen rows. A and B chunks have `cy % 2 === 0` — the upper rows. Gravity means lower tiles must vacate their space before upper tiles can fall into it. Processing lower-row chunks first allows upper-row chunks to cascade naturally into the freed space within the same coordinator step. Without this ordering, a visible gap appears at every chunk-row boundary (every 64 pixels) as matter falls.

### Within-round worker batching

Each round's tiles are distributed across the pool workers by chunk, round-robin:

```
chunk (cx, cy) → key = cy * chunksWide + cx
first new key  → worker 0
second new key → worker 1
...wraps at pool size
```

A single worker may receive tiles from multiple chunks, but all chunks assigned to the same worker are non-adjacent (guaranteed by the checkerboard). Workers run concurrently within a round via `Promise.all`.

## MatterSim.processSubset

Each pool worker holds a `MatterSim` instance that processes the tile indices sent to it:

1. `stepGen++` — advances the generation counter used for double-processing prevention.
2. Sort indices **by y descending** (bottom row first). This lets tiles fall into the space just vacated by the tile below them within the same pass, producing natural cascade without gaps.
3. For each index: skip if `movedThisStep[idx] === stepGen` (the cell was a move destination this step). Otherwise run `MATTER_ACTIONS[type](sim, tx, ty, idx)`.
4. When `tryMove` or `tryRise` succeeds, stamp `movedThisStep[toIdx] = stepGen` on the destination to prevent the arriving tile from being processed again. Gases rise to a lower-y cell that comes later in the sorted order, so the stamp is necessary for them; solid tiles fall to higher-y cells that were already processed, so the stamp is mainly a safety guard there.

`leftFirst` is set once per coordinator step (alternates each frame) and controls which horizontal direction each element action tries first.

## Worker result messages

Each pool worker sends one `DONE` message per round dispatch:

```ts
{
  next: number[]                      // tile indices to activate next step
  vfxJustSettled: number[]            // indices of tiles that just settled
  structuralRemovals: number[]        // indices removed by destruction
  matterTankTransfers: Int32Array     // transferable — matter credits to distribute
  matterReservationReleases: Int32Array  // transferable — reservation releases
}
```

`matterTankTransfers` and `matterReservationReleases` use transferable ArrayBuffers to avoid copying.

## ParticleSim

`ParticleSim` runs on the **coordinator thread** (not a separate worker). It steps after all pool worker rounds complete each tick. Particles read and write the shared `tiles` SAB directly. Activated tile indices from particle impacts go into `particleSim.pendingActivations`, which the coordinator adds to the active set for the next step.

## Render dirty tracking

Workers call `chunkGrid.markDirty(chunkIdx)` inside `tryMove` and `reactivateAround`, which increments `renderGen[chunkIdx]` in the chunk grid SAB. The main thread renderer polls `renderGen` each `requestAnimationFrame` and re-uploads any chunk whose gen changed since the last frame.
