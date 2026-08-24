/// <reference lib="webworker" />

// Accumulates net matter changes between conservation check intervals.
// All values are in fill units: 1 solid tile = FILL_MAX, 1 liquid tile = fill[idx].
// Using a single unit means cross-domain conversions (solid↔liquid) cancel automatically.
export class ConservationTracker {
  private _delta = 0

  addDelta(fillUnits: number) {
    this._delta += fillUnits
  }

  consumeDelta(): number {
    const d = this._delta
    this._delta = 0
    return d
  }
}
