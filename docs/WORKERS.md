# Workers

The matter simulation runs across three thread contexts: the main thread, a coordinator worker, and a pool of sim workers. All three share the same `SharedArrayBuffer` tile data — no copying between threads for tile state itself (tile *changes* reach the renderer through a separate publish step — see "Render dirty tracking" below).

## Thread layout

```
Main thread
  └─ CoordinatorController      postMessage  →  Coordinator worker
                                               (Coordinator.ts)
                                                ├─ SimWorkerPool
                                                │   ├─ MatterSimController → MatterSim worker 0
                                                │   ├─ MatterSimController → MatterSim worker 1
                                                │   └─ ... (hardwareConcurrency - 2 workers)
                                                ├─ PhysicsBodyProcessor (runs on coordinator thread)
                                                └─ ParticleSim (runs on coordinator thread)
```

**Pool size**: `Math.max(1, navigator.hardwareConcurrency - 2)` — leaves one core for the main thread and one for the coordinator.

## Shared memory

All workers attach views to the same SABs on `INIT`:

| SAB | View type | Purpose |
|-----|-----------|---------|
| `tilesBuffer` | `Uint32Array` | Per-tile matter state (type, settled bit, owner, counter) |
| `fillBuffer` | `Float32Array` | Per-tile liquid fill level |
| `chunkGrid.*` | various | Per-chunk render/collision gens, solid counts, anchored flags |

Workers write directly to these buffers. No message-passing for tile data itself. The main thread does *not* read these buffers directly for rendering — see "Render dirty tracking" below for the separate front-buffer bridge.

Each pool worker additionally gets its own **scratch buffers** (`MatterSimScratchData`, one set of `SharedArrayBuffer`-backed `Int32Array`s per worker — `indices`, `next`, `vfxJustSettled`, `structuralRemovals`, capacity `SIM_SCRATCH_CAPACITY = 262_144` each). These carry the per-round dispatch payload without a `postMessage` structured-clone — see "Worker result messages" below.

## Coordinator loop

`Coordinator.worker.ts` drives a self-scheduling loop:

```
setTimeout(step, 8ms) → step() → setTimeout(step, 8ms) → ...
```

Each `step()`:
1. Drain pending activations from physics-body tile writes into the active set.
2. Run `PhysicsBodyProcessor.process()` on the coordinator thread (rasterizes rigid-body footprints into the tilemap, handles liquid displacement). Uses the coordinator's own local `MatterSim` instance directly, not one of the worker-pool's instances.
3. Early-return if there's no active tile, brush/tunnel/projectile work, and no live particles — skips the rest of the step entirely.
4. Increment the frame counter; swap active/idle sets so new activations during this step land in the fresh set instead of the one about to be dispatched.
5. Run brush add/erase, tunnel-weapon, and projectile mutations directly (single-threaded, before workers see the tiles).
6. `await workerPool.step(snapshot, leftFirst, frame, ...)` — dispatches the CA rounds (see below) and folds each round's results (`next`, `vfxJustSettled`, `structuralRemovals`, matter-tank transfers) into coordinator state as they arrive.
7. Run `sim.doUpwardPressurePass()` on the coordinator's own `MatterSim` instance — safe because all worker rounds are done, so there are no concurrent writers to `tiles`/`fill`.
8. Run structural/physics-island checks for anything the workers or particle sim removed.
9. Run `particleSim.step()` on the coordinator thread.
10. Periodically run the dev-only matter-conservation check.
11. `tilePublisher.publish()` — copies dirty chunks to the render-front buffers (see "Render dirty tracking").

## 4-group chunk checkerboard

The active tile set is divided into four groups based on each tile's real chunk position (`CHUNK_SIZE = 64` — the same size used for collision/rendering; there is no separate, finer dispatch granularity). Chunks in the same group are never adjacent, so workers processing them in parallel can never write to the same cell or each other's neighbouring cells:

```
A B A B A B   ← all processed in one step (groups A, B, C, D run sequentially, fixed order)
C D C D C D
A B A B A B
C D C D C D

formula: (cy & 1) * 2 + (cx & 1)  →  0=A  1=B  2=C  3=D
```

Each group spans the *entire* map, not a row-band or region — this is what lets a single worker round use the whole pool regardless of how tall or spatially concentrated the active area is. Groups are dispatched in fixed order (0, 1, 2, 3), with an `await Promise.all` between each — always exactly 4 round trips per coordinator step, no matter how much is active or how the map is shaped.

### Known cosmetic tradeoff: chunk-boundary banding

This scheme has a real, structural artifact: continuously falling matter shows visible horizontal banding/gaps at chunk-row boundaries. This is not a bug to be fixed by reordering — it was investigated extensively (alternating which group runs first per frame, staggering the grid origin per frame with various offset patterns, a fully sequential bottom-up row-sweep alternative) and confirmed structurally unavoidable with any small fixed number of dispatch phases per tick; only a true sequential bottom-up sweep removes it, and that scheme was measurably too slow under heavy load. The banding is an accepted performance/cosmetics tradeoff, not an oversight — **do not attempt a "correct ordering" fix** without first checking the project's dispatch-history notes; several plausible-sounding fixes were tried and empirically failed.

A within-round bottom-up sort (see below) still gives correct, gap-minimizing behavior *within* a single group's dispatch.

### Within-round worker batching

Each group's tiles are distributed across the pool workers by chunk, round-robin:

```
chunk (cx, cy) → key = cy * chunksWide + cx
first new key  → worker 0
second new key → worker 1
...wraps at pool size
```

A single worker may receive tiles from multiple chunks, but all chunks assigned to the same worker are non-adjacent (guaranteed by the checkerboard). Workers run concurrently within a round via `Promise.all`.

Before splitting into per-worker batches, each group's full tile list is sorted **by y descending** (bottom row first, `SimWorkerPool.step()`, not inside the worker). This lets tiles fall into the space just vacated by the tile below them within the same dispatch, and — since a tile only ever moves into a cell that wasn't independently active this round (destinations must be empty or sink-through) — this sort is what prevents a tile from being processed twice within one worker's batch. There's no separate per-tile generation stamp; correctness relies entirely on this sort plus the checkerboard's non-adjacency guarantee.

`leftFirst` is set once per coordinator step (alternates each frame) and controls which horizontal direction each element action tries first — this exists to avoid a permanent left/right bias in horizontal flow/equalize passes, and is unrelated to the checkerboard grouping (which has no frame-dependent offset).

## MatterSim.processSubset

Each pool worker holds a `MatterSim` instance. `process(indicesCount, leftFirst, frame, out)`:

1. Resets per-round scratch state (`next` set, `vfxJustSettled`/`structuralRemovals` arrays, conservation accumulators).
2. Runs `processSubset()` over its assigned indices (already sorted bottom-up by the coordinator/pool before dispatch — see above): for each index, look up its matter type and run `MATTER_ACTIONS[type](sim, tx, ty, idx)`. No generation/phase gating inside this loop.
3. Copies results (`next`, `vfxJustSettled`, `structuralRemovals`) into the worker's shared scratch buffers and returns counts (see below).

## Worker result messages

Indices going in, and results coming out, travel through per-worker `SharedArrayBuffer` scratch space (`MatterSimScratchData`) instead of array payloads in the message body — avoids a `postMessage` structured-clone of what can be a many-thousand-entry array every round. The wire message itself carries only counts:

```ts
{
  nextCount: number
  vfxJustSettledCount: number
  structuralRemovalsCount: number
  matterTankTransfers: Int32Array        // transferable — matter credits to distribute
  matterReservationReleases: Int32Array  // transferable — reservation releases
}
```

`MatterSimController` (coordinator side) hydrates this into `Int32Array.subarray()` views onto the same shared buffers before handing it to `SimWorkerPool`/`Coordinator.ts` — those consumers see `next`/`vfxJustSettled`/`structuralRemovals` as `Int32Array`s (a drop-in for the old `number[]`, `for-of`/`.length` work identically). `matterTankTransfers`/`matterReservationReleases` separately use transferable `ArrayBuffer`s, unrelated to the scratch-buffer mechanism.

## ParticleSim

`ParticleSim` runs on the **coordinator thread** (not a separate worker). It steps after all pool worker rounds complete each tick. Particles read and write the shared `tiles` SAB directly. Activated tile indices from particle impacts go into `particleSim.pendingActivations`, which the coordinator adds to the active set for the next step.

## Render dirty tracking

Workers (and the coordinator's own local `MatterSim`/`PhysicsBodyProcessor`) call `chunkGrid.markDirty(chunkIdx)` / `markRenderDirty(chunkIdx)`, which bump `renderGen`/`collGen` on the **back** `ChunkGrid` — a plain `renderGen[idx]++`, not atomic, since the checkerboard dispatch guarantees exactly one worker touches a given real chunk per round.

The main thread never reads these back-buffer values directly. At the end of every `Coordinator.step()`, `ChunkPublisher.publish()` (coordinator thread, single-threaded) compares each chunk's back `renderGen` against its own last-seen value; for anything changed, it copies that chunk's tile/fill data from the back SABs to a separate set of **front** SABs (`TileFrontData`), then does `Atomics.add` on the front's own `genView` for that chunk (release fence). The main-thread renderer reads `genView` with `Atomics.load` (acquire fence) each frame and re-uploads any chunk whose front gen changed — so it always sees a fully consistent post-step snapshot, never a partial one.
