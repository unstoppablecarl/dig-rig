import { FireMode } from '../Player/_FireMode-types'
import type { Tile } from '../Tilemap/Tilemap.ts'
import { BaseProjectile } from './BaseProjectile.ts'
import { radiusToTiles } from './projectile-radius'

const MAX_RADIUS = 20

// Each record holds the EXACT tiles destroyed in one sweep, plus the center position
// used for proximity pre-screening.  `remaining` is compacted in-place each frame:
// tiles too close to the player stay; tiles that are placed or obstructed are removed.
export type SweepRecord = { cx: number; cy: number; radius: number; remaining: Tile[] }

export class TunnelDestroyProjectile extends BaseProjectile {
  readonly mode = FireMode.DESTROY as const

  static MAX_TILES_TO_MOD = radiusToTiles(MAX_RADIUS)
  active = false
  fired = true
  radius = 20

  public sweepQueue: SweepRecord[] = []

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

    // Reset per-frame: this projectile runs indefinitely, so cross-frame deduplication
    // would permanently block tiles that the restore system has refilled.
    this.visitedTiles.clear()

    const charge = this.charge()
    if (charge > 0) {
      const tiles = this.applyTiles(charge)
      if (tiles.length > 0) {
        this.sweepQueue.push({ cx: this.x, cy: this.y, radius: this.radius, remaining: tiles.slice() })
      }
    } else {
      this.recharge()
    }
  }
}
