// FILL_MAX — fill value of a completely full liquid cell.
//   Higher → more granular sub-cell resolution; U-tube pressure head increases
//            proportionally; float32 conservation drift is larger in absolute terms.
//   Lower  → liquid behaves more "blobby"; less precision in partial fills.
//   Changing this: FILL_MIN and FILL_ROUND_TO_ZERO do NOT scale automatically —
//   keep them at roughly FILL_MAX * 3e-5 or less to stay above float32 noise.
//   FILL_COMPRESSION_FACTOR, FILL_SETTLED_FACTOR, and the divisors all scale fine.
//   base = 32
export const FILL_MAX = 32 as const

// FILL_MIN — minimum fill below which a cell is skipped for flow.
//   Higher → larger dead-zone; thin streams can stall or gap visually.
//   Lower  → more flow work on nearly-empty cells; can cause slow oscillation.
//   Keep in sync with FILL_ROUND_TO_ZERO; both should be < FILL_MAX * 3e-5.
//   base = 0.001
export const FILL_MIN = 0.001 as const

// FILL_ROUND_TO_ZERO — zombie-tile cleanup threshold in doFillTransfer.
//   If fill drops below this after a transfer the tile is destroyed (fill clamped to 0).
//   Should match FILL_MIN. If higher than FILL_MIN a tile can be destroyed while
//   tryFillFlow still considers it active, losing a small amount of mass.
//   base = 0.001
export const FILL_ROUND_TO_ZERO = 0.001 as const

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