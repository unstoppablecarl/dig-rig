// FILL_MAX — fill value of a completely full liquid cell.
//   All fill values are kept as integers (0..FILL_MAX) so conservation arithmetic
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

// FILL_COMPRESSION_FACTOR — fraction of FILL_MAX the column can compress before
//   upward pressure activates (used in getStableState).
//   Higher → liquid is more compressible; U-tubes equalize more slowly; liquid
//            piles up before pushing upward.
//   Lower  → more incompressible; U-tubes equalize faster but may oscillate.
//   base = 0.02
export const FILL_COMPRESSION_FACTOR = 0.02 as const

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

// FILL_COL_SCAN_MAX — how many cells above (tx, ty) colPressureAbove scans for
//   U-tube column pressure. Caps the pressure head for very tall columns.
//   Higher → accurate pressure for tall U-tubes; proportionally more expensive.
//   Lower  → cheaper; U-tube arms taller than this value can't fully equalize
//            via floor pressure alone.
//   base = 32
export const FILL_COL_SCAN_MAX = 32 as const

// Maximum horizontal distance scanned in a single step — caps both liquid
// flow path-finding (tryFlowHorizontal) and settled-liquid wakeup chains
// (reactivateAround). Mirrors FILL_COL_SCAN_MAX for the horizontal axis.
//   Higher → wider pools level faster; more work per step.
//   Lower  → cheaper; wide pools may not fully equalize each frame.
//   base = 64
export const FILL_ROW_SCAN_MAX = 64 as const