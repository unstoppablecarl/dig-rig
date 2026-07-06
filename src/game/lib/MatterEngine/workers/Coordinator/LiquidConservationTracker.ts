/// <reference lib="webworker" />

// Accumulates net liquid fill changes from all external operations between
// conservation check intervals. Call addDelta() from brush, projectile,
// tunnel, and worker result paths; call consumeDelta() in the check.
export class LiquidConservationTracker {
  private _net = 0

  addDelta(delta: number) {
    this._net += delta
  }

  consumeDelta(): number {
    const v = this._net
    this._net = 0
    return v
  }
}
