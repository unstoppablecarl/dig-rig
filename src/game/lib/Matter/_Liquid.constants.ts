// FILL_MAX — fill value of a completely full liquid cell.
//   All fill values are kept as integers (0...FILL_MAX) so conservation arithmetic
//   is exact. Float32 represents integers exactly up to 2^24, far above any cell value.
//   Higher → more sub-cell resolution; column pressure head scales proportionally.
//   Lower  → liquid behaves more "blobby"; less precision in partial fills.
//   Changing this: FILL_ROUND_TO_ZERO is an integer threshold — update it together.
//   FILL_COMPRESSION_FACTOR, FILL_SETTLED_FACTOR, and divisors scale
//   automatically, but verify FILL_MAX * FILL_COMPRESSION_FACTOR stays a useful integer.
//   base = 256
export const FILL_MAX = 256 as const

// FILL_ROUND_TO_ZERO — minimum transferable fill threshold in tryFillFlow.
//   When a tile reaches !moved and has fill at or below this value it is consumed.
//   Fill=1 with FILL_PRESSURE_DIVISOR=4 produces floor(1/4)=0 — no transfer is
//   possible, so the tile is permanently stranded. Consuming it prevents micro-fill
//   puddles from sitting idle forever. Tracked in liquidNetDelta so conservation
//   accounting stays balanced.
//   base = 1
export const FILL_ROUND_TO_ZERO = 1 as const

// FILL_FLOW_DEADBAND — minimum computed `want`/flow in tryFillFlow's
//   horizontal-equalization and upward-pressure steps for it to count as a
//   real transfer. At or below this, the imbalance is treated as already
//   resolved: no transfer happens, and it does NOT set `moved=true`, so the
//   tile can settle (WATER_SETTLED) instead of chasing an unresolvable
//   1-unit rounding difference with a neighbor forever. Also gates
//   reactivateAround's horizontal wake-chain in doFillTransfer, so a
//   sub-threshold transfer doesn't cascade-un-settle up to FILL_ROW_SCAN_MAX
//   tiles of neighboring liquid.
//
//   This is a real, defensible fix for pure integer-rounding oscillation,
//   but verified NOT to be the (sole) explanation for a wide pool's
//   active-tile count plateauing at ~20-23k instead of decaying toward idle
//   — that plateau persisted identically with this deadband in place. The
//   actual driver: tryFillFlow's horizontal step only ever exchanges mass
//   with the immediately-adjacent cell (ax/bx), so a disturbance can only
//   physically propagate ~1 tile/tick — an O(pool width) convergence time
//   that no per-step tuning constant fixes (confirmed: halving
//   FILL_PRESSURE_DIVISOR, which controls how much moves between two
//   already-adjacent cells, did not measurably change the convergence rate).
//   A real fix needs a horizontal analog of colPressureAbove — aggregating
//   pressure across a wide span in one step instead of nearest-neighbor
//   only — which is a bigger design change, not a constant tweak. Keeping
//   this deadband regardless: harmless, and correct for the narrower bug
//   class it targets.
//   Higher → pools settle faster/more reliably; may leave a barely-visible
//            residual unevenness (sub-threshold imbalances never resolve).
//   Lower  → chases smaller imbalances but risks perpetual low-level activity/cost.
//   base = 2
export const FILL_FLOW_DEADBAND = 2 as const

// FILL_COMPRESSION_FACTOR — fraction of FILL_MAX the column can compress before
//   upward pressure activates (used in getStableState). This is also the
//   headroom of getStableState's saturation ceiling above FILL_MAX — at 0.02
//   that headroom was only ~5 fill units, so the transition from "not
//   capped" to "capped" happened almost immediately past ~2 cells' worth of
//   stacked mass. Two adjacent columns near that threshold, differing by
//   even a tiny amount (e.g. the checkerboard dispatch's fixed per-tick
//   round order giving one side of a chunk seam fresher neighbor data than
//   the other, every tick) could land on opposite sides of it — one denser
//   (capped, fewer rows for the same volume), one not — locking in a
//   persistent, self-reinforcing surface-height difference right at chunk
//   boundaries. Raised to 0.05 (~13 units of headroom) so tiny cross-seam
//   differences land at genuinely different points along the still-rising
//   part of the curve instead of both immediately flattening to the same
//   rounded integer. Verified: eliminates the chunk-boundary height jump
//   (max single-step delta 3-4 tiles vs 10-23 at 0.02) without reintroducing
//   the unbounded-growth bug the cap itself exists to prevent (fill still
//   hard-bounded, just at a slightly higher ceiling), and with no measurable
//   throughput cost (pnpm run bench:sim, within normal run-to-run noise) —
//   0.15 fixes it just as well but costs ~20% throughput, not worth it.
//   Higher → liquid is more compressible; U-tubes equalize more slowly; liquid
//            piles up before pushing upward.
//   Lower  → more incompressible; U-tubes equalize faster but may oscillate;
//            too low re-narrows the headroom and can reintroduce the
//            chunk-boundary artifact above.
//   base = 0.05
export const FILL_COMPRESSION_FACTOR = 0.05 as const

// FILL_SETTLED_FACTOR — fraction of FILL_MAX the cell below must reach before
//   horizontal equalization is allowed (the "settled" check in tryFillFlow).
//   Higher (→1.0) → liquid only spreads sideways when nearly fully supported;
//                   produces taller, narrower streams.
//   Lower  (→0.0) → liquid spreads sideways very early; wider, flatter behavior;
//                   too low can cause instability in thin falling columns.
//   base = 0.5
export const FILL_SETTLED_FACTOR = 0.5 as const

// FILL_PRESSURE_DIVISOR — dampens per-step flow for floor cells using column
//   pressure equalization (U-tube arms, tryFillFlow step 2 floor branch).
//   Higher → slower floor equalization; U-tube arms take more frames to balance.
//   Lower  → faster equalization; may overshoot and oscillate.
//   base = 4
export const FILL_PRESSURE_DIVISOR = 4 as const

// Maximum horizontal distance scanned in a single step — caps both liquid
// flow path-finding (tryFlowHorizontal) and settled-liquid wakeup chains
// (reactivateAround).
//   Higher → wider pools level faster; more work per step.
//   Lower  → cheaper; wide pools may not fully equalize each frame.
//   base = 64
export const FILL_ROW_SCAN_MAX = 64 as const