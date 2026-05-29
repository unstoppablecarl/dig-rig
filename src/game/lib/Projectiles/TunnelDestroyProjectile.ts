import { FireMode } from '../../config.ts'
import { BaseProjectile } from './BaseProjectile.ts'
import { radiusToTiles } from './projectile-radius'

const MAX_RADIUS = 20

export type SweepRecord = { x: number; y: number; radius: number }

export class TunnelDestroyProjectile extends BaseProjectile {
  readonly mode = FireMode.DESTROY as const

  static MAX_TILES_TO_MOD = radiusToTiles(MAX_RADIUS)
  active = false
  fired = true
  radius = 20

  public sweepQueue: SweepRecord[] = []
  private _lastSweepX = NaN
  private _lastSweepY = NaN

  setTilesToModify(): boolean {
    return false
  }

  recharge() {
    const available = this.matterTank.chargeAvailable(FireMode.DESTROY)
    if (available < TunnelDestroyProjectile.MAX_TILES_TO_MOD) return
    this.tilesModified = 0

    this.tilesToModify = available
    this.matterTank.addPendingCharge(FireMode.DESTROY, this.tilesToModify)
  }

  fire() {
    this.recharge()
  }

  update() {
    this.renderer?.setVisible(this.active)
    if (!this.active) return

    const charge = this.charge()
    if (charge > 0) {
      const destroyed = this.destroyTiles(charge)
      if (destroyed > 0) this._recordSweep()
    } else {
      this.recharge()
    }
  }

  private _recordSweep() {
    const cx = this.x
    const cy = this.y
    const minDist = this.radius * 0.25

    if (isNaN(this._lastSweepX)) {
      this._lastSweepX = cx
      this._lastSweepY = cy
      this.sweepQueue.push({ x: cx, y: cy, radius: this.radius })
      return
    }

    const dx = cx - this._lastSweepX
    const dy = cy - this._lastSweepY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) return

    // If the arm jumped more than minDist in one frame (e.g. fast turn), interpolate
    // so no two adjacent records are more than minDist apart.  Without this, a sharp
    // turn creates a coverage gap at the outer tunnel wall.
    const steps = Math.ceil(dist / minDist)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      this.sweepQueue.push({ x: this._lastSweepX + dx * t, y: this._lastSweepY + dy * t, radius: this.radius })
    }

    this._lastSweepX = cx
    this._lastSweepY = cy
  }
}