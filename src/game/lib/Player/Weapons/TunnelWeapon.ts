import { Scenes } from 'phaser'
import { DISPLAY_TUNNEL_WEAPON_MATTER_TANK_DEBUG } from '../../../config.ts'
import { shuffleArray } from '../../../helpers/array.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { WeaponConstantInput } from '../../Input/InputController/WeaponInputControllers/WeaponConstantInput.ts'
import type { Weapon } from '../../Input/InputController/WeaponManagerInput.ts'
import { EMPTY, MatterType } from '../../Matter/_Matter-types.ts'
import { MatterTank } from '../../Matter/MatterTank/MatterTank.ts'
import type { ProjectileEffectResult } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { PROJECTILE_EFFECT } from '../../Projectiles/ProjectileEffect/ProjectileEffect.ts'
import type { SweepRecord } from '../../Projectiles/TunnelDestroyProjectile.ts'
import { TunnelDestroyProjectile } from '../../Projectiles/TunnelDestroyProjectile.ts'
import type { Tile } from '../../Tilemap/Tilemap.ts'
import { FireMode } from '../_FireMode-types'
import UPDATE = Scenes.Events.UPDATE

// Per-tile safe radius: tiles this close to the player are held in the record's
// remaining list and retried next frame instead of being created immediately.
// Must exceed PLAYER_RADIUS_Y + PLAYER_CREATE_VEL_EXTEND (~23) to stay clear of
// CREATE effect's filterTile.
const TILE_SAFE_RADIUS = 25
const TILE_SAFE_RSQ = TILE_SAFE_RADIUS * TILE_SAFE_RADIUS

const MAX_RESTORE_PARTICLES = 40

export class TunnelWeapon extends WeaponConstantInput implements Weapon {
  private projectileDestroy: TunnelDestroyProjectile | null = null
  matterTank!: MatterTank

  private _restoreVisited = new Set<number>()
  private _restoreResult: Tile[] = []
  private _commitOut: ProjectileEffectResult[] = []
  private _emitPos: Position = { x: 0, y: 0 }

  constructor(scene: GameLevel) {
    super(scene)
    // Registered directly so restore runs every frame regardless of active weapon / firing state.
    scene.events.on(UPDATE, this.processRestoreTiles, this)
  }

  private _startPos: Position = { x: 0, y: 0 }
  private _pos: Position = { x: 0, y: 0 }

  getCharge(): number {
    return 0
  }

  updateFiring(value: boolean): void {
    if (this.projectileDestroy) {
      this.projectileDestroy.active = value
      const destroyPos = this.scene.player.getProjectilePosition(0, this._pos)
      this.projectileDestroy.x = destroyPos.x
      this.projectileDestroy.y = destroyPos.y
    }
  }

  protected onEnable() {
    if (!this.matterTank) {
      this.matterTank = this.scene.matterManager.makeMatterTank(this.scene.player, TunnelDestroyProjectile.MAX_TILES_TO_MOD * 5)
    }
    this.initDestroyProjectile()
    if (DISPLAY_TUNNEL_WEAPON_MATTER_TANK_DEBUG) {
      this.scene.weaponUIState.activeMatterTank = this.matterTank
    }
  }

  protected onDisable() {
    super.onDisable()
    if (DISPLAY_TUNNEL_WEAPON_MATTER_TANK_DEBUG) {
      this.scene.weaponUIState.activeMatterTank = this.scene.player.matterTank
    }
  }

  private initDestroyProjectile() {
    if (this.projectileDestroy) return
    const availableCharge = this.matterTank.chargeAvailable(FireMode.DESTROY)
    const charge = Math.min(TunnelDestroyProjectile.MAX_TILES_TO_MOD, availableCharge)
    const startPos = this.scene.player.getProjectilePosition(0, this._startPos)
    this.projectileDestroy = this.scene.projectiles.add(
      TunnelDestroyProjectile,
      this.matterTank,
      startPos.x,
      startPos.y,
      charge,
      PROJECTILE_EFFECT.DESTROY,
    )
  }

  private processRestoreTiles() {
    const dp = this.projectileDestroy
    if (!dp) return
    const queue = dp.sweepQueue
    const tilemap = this.scene.tilemap
    const width = tilemap.width
    const px = this.scene.player.x
    const py = this.scene.player.y
    const available = this.matterTank.chargeAvailable(FireMode.CREATE)

    if (!queue.length && available <= 0) return

    // The destroy projectile is offset ~18px from the player body via the arm
    // transform, so the player-center TILE_SAFE_RADIUS guard doesn't fully cover
    // its circle. Track the actual destroy position so we never restore tiles
    // that are still inside the active destroy zone.
    const dpx = dp.active ? dp.x : NaN
    const dpy = dp.active ? dp.y : NaN
    const dpR2 = dp.radius * dp.radius

    const visited = this._restoreVisited
    visited.clear()
    const result = this._restoreResult
    result.length = 0

    let writeIdx = 0
    let outOfMatter = available <= 0

    for (let i = 0; i < queue.length; i++) {
      const record = queue[i]

      if (outOfMatter) {
        queue[writeIdx++] = record
        continue
      }

      // Fast path: if all tiles in this record are guaranteed outside TILE_SAFE_RADIUS
      // (record center is farther than radius + TILE_SAFE_RADIUS), skip per-tile checks.
      const dx = record.cx - px
      const dy = record.cy - py
      const allSafe = dx * dx + dy * dy > (record.radius + TILE_SAFE_RADIUS) ** 2

      // Guard against partial annular fills. remaining[] is sorted inner-to-outer
      // (commitTiles sorts by dist from destroy center). If the innermost tile is
      // still inside a deferred zone, hold the whole record — filling the outer ring
      // first would create isolated solid islands with an empty center.
      if (!allSafe && record.remaining.length > 0) {
        const ft = record.remaining[0]
        const ftdx = ft.x - px, ftdy = ft.y - py
        const ftddx = ft.x - dpx, ftddy = ft.y - dpy
        if ((ftdx * ftdx + ftdy * ftdy <= TILE_SAFE_RSQ) ||
          (ftddx * ftddx + ftddy * ftddy <= dpR2)) {
          queue[writeIdx++] = record
          continue
        }
      }

      const obstructed = this._processRecord(record, result, visited, available, px, py, allSafe, dpx, dpy, dpR2)

      // Flood-fill fallback for tiles whose exact position was obstructed (solid).
      // Phase 1: adjacent-to-solid tiles only. Phase 2: any empty tile.
      if (obstructed > 0 && result.length < available) {
        const cx = Math.round(record.cx)
        const cy = Math.round(record.cy)
        const targetLen = Math.min(result.length + obstructed, available)
        const maxRadius = record.radius * 4
        const scanCircle = (adjOnly: boolean) => {
          let searchRadius = record.radius
          while (result.length < targetLen && searchRadius <= maxRadius) {
            tilemap.getCircle(cx, cy, searchRadius, (x, y) => {
              if (tilemap.getTile(x, y) !== EMPTY) return false
              if (adjOnly && !this._isAdjacentToSolid(x, y)) return false
              const key = y * width + x
              if (visited.has(key)) return false
              if (!allSafe) {
                const fdx = x - px, fdy = y - py
                if (fdx * fdx + fdy * fdy <= TILE_SAFE_RSQ) return false
              }
              const ddx = x - dpx, ddy = y - dpy
              if (ddx * ddx + ddy * ddy <= dpR2) return false
              visited.add(key)
              result.push({ x, y })
              return result.length >= targetLen
            }, true)
            searchRadius = Math.round(searchRadius * 1.5)
          }
        }
        scanCircle(true)
        if (result.length < targetLen) scanCircle(false)
      }

      if (result.length >= available) outOfMatter = true

      if (record.remaining.length > 0) {
        queue[writeIdx++] = record
      }
    }
    queue.length = writeIdx

    // Global fallback: only when the sweep queue is truly empty. If records are
    // still pending (deferred because the player hasn't moved far enough), don't
    // place tiles — they'll be restored from the queue as the player moves away.
    if (!outOfMatter && result.length < available && queue.length === 0) {
      const cx = Math.round(px)
      const cy = Math.round(py)
      const scanGlobal = (adjOnly: boolean) => {
        let searchRadius = TILE_SAFE_RADIUS + 1
        while (result.length < available && searchRadius <= 200) {
          tilemap.getCircle(cx, cy, searchRadius, (x, y) => {
            if (tilemap.getTile(x, y) !== EMPTY) return false
            if (adjOnly && !this._isAdjacentToSolid(x, y)) return false
            const key = y * width + x
            if (visited.has(key)) return false
            const fdx = x - px, fdy = y - py
            if (fdx * fdx + fdy * fdy <= TILE_SAFE_RSQ) return false
            const ddx = x - dpx, ddy = y - dpy
            if (ddx * ddx + ddy * ddy <= dpR2) return false
            visited.add(key)
            result.push({ x, y })
            return result.length >= available
          }, true)
          searchRadius = Math.round(searchRadius * 1.5)
        }
      }
      scanGlobal(true)
      if (result.length < available) scanGlobal(false)
    }

    if (result.length > 0) {
      this._applyCreate(result)
    }
  }

  // Compacts record.remaining in-place:
  //   - tiles too close to player OR inside active destroy circle → kept for next frame
  //   - tiles at the matter cap → kept for next frame
  //   - tiles at empty positions → added to result (consumed)
  //   - tiles at solid positions → counted as obstructed (consumed, fall through to flood fill)
  // Returns the number of obstructed tiles encountered.
  private _processRecord(
    record: SweepRecord,
    result: Tile[],
    visited: Set<number>,
    available: number,
    px: number,
    py: number,
    allSafe: boolean,
    dpx: number,
    dpy: number,
    dpR2: number,
  ): number {
    const { tilemap } = this.scene
    const { width } = tilemap
    const remaining = record.remaining
    let writeIdx = 0
    let obstructed = 0
    let limitHit = false

    for (let i = 0; i < remaining.length; i++) {
      const tile = remaining[i]

      if (limitHit) {
        remaining[writeIdx++] = tile
        continue
      }

      if (!allSafe) {
        const tdx = tile.x - px
        const tdy = tile.y - py
        if (tdx * tdx + tdy * tdy <= TILE_SAFE_RSQ) {
          remaining[writeIdx++] = tile  // too close to player — defer to next frame
          continue
        }
      }

      // Defer tiles still inside the active destroy circle. The destroy projectile
      // sits ~18px from the player body center (arm offset), so the player-center
      // TILE_SAFE_RADIUS guard alone doesn't cover the full destroy zone.
      const ddx = tile.x - dpx
      const ddy = tile.y - dpy
      if (ddx * ddx + ddy * ddy <= dpR2) {
        remaining[writeIdx++] = tile  // inside destroy zone — defer to next frame
        continue
      }

      if (result.length >= available) {
        limitHit = true
        remaining[writeIdx++] = tile  // matter cap — defer to next frame
        continue
      }

      if (tilemap.getTile(tile.x, tile.y) !== EMPTY) {
        obstructed++
        continue  // solid — fall through to flood fill
      }

      const key = tile.y * width + tile.x
      if (visited.has(key)) continue
      visited.add(key)
      result.push(tile)
    }

    remaining.length = writeIdx
    return obstructed
  }

  private _isAdjacentToSolid(x: number, y: number): boolean {
    const { tilemap } = this.scene
    return (
      tilemap.getTile(x - 1, y) !== EMPTY ||
      tilemap.getTile(x + 1, y) !== EMPTY ||
      tilemap.getTile(x, y - 1) !== EMPTY ||
      tilemap.getTile(x, y + 1) !== EMPTY
    )
  }

  private _applyCreate(tiles: Tile[]) {
    this._commitOut.length = 0
    if (!tiles.length) return this._commitOut
    const created = this._commitOut
    const tilemap = this.scene.tilemap

    const newValue = PROJECTILE_EFFECT.CREATE_SOLID.convertMatterType(MatterType.EMPTY)!
    for (const { x, y } of tiles) {
      tilemap.setTile(x, y, newValue)
      created.push({ x, y, newValue })
    }
    PROJECTILE_EFFECT.CREATE_SOLID.onTilesCommitted(tilemap, created)

    if (!created.length) return
    this.matterTank.addPendingCharge(FireMode.CREATE, created.length)
    const source = this.scene.player.matterParticleEmitPosition(this._emitPos)
    shuffleArray(created)
    const n = Math.min(created.length, MAX_RESTORE_PARTICLES)
    for (let i = 0; i < n; i++) {
      this.scene.vfxParticleManager.spawnMatter(source, created[i], true)
    }
    this.matterTank.applyPendingCharge(FireMode.CREATE, created.length)
  }

  protected onDestroy() {
    this.scene.events.off(UPDATE, this.processRestoreTiles, this)
    super.onDestroy()
    this.projectileDestroy?.destroy()
    this.projectileDestroy = null
  }
}
