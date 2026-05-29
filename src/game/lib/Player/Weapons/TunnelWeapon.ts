import { FireMode } from '../../../config.ts'
import { shuffleArray } from '../../../helpers/array.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import type { Weapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponConstantInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponConstantInput.ts'
import { MatterTank } from '../../Matter/MatterTank.ts'
import type { Tile } from '../../Tilemap/Tilemap.ts'
import { TerrainType } from '../../Tilemap/_Tilemap-types.ts'
import { TunnelDestroyProjectile } from '../../Projectiles/TunnelDestroyProjectile.ts'

// record.radius + this = min center-to-center dist from record to player before processing.
// Must satisfy: PLAYER_SAFE_MARGIN - 5 > PLAYER_RADIUS_Y + PLAYER_CREATE_VEL_EXTEND (= 23)
// so no restore tile (at most record.radius+5 from record) falls inside applyCreateTiles' AABB filter.
const PLAYER_SAFE_MARGIN = 30
// Particles per restore batch — the area can be hundreds of tiles; cap to avoid particle spam.
const MAX_RESTORE_PARTICLES = 40

export class TunnelWeapon extends WeaponConstantInput implements Weapon {
  readonly displayName = 'Tunnel'

  private projectileDestroy: TunnelDestroyProjectile | null = null
  readonly matterTank: MatterTank

  // Shared visited set and result buffer across all records in one frame.
  // This lets applyCreateTiles (and computeAnchored inside it) run exactly once per frame.
  private _restoreVisited = new Set<number>()
  private _restoreResult: Tile[] = []
  private _emitPos: Position = { x: 0, y: 0 }

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.matterTank = new MatterTank(scene.matterManager, TunnelDestroyProjectile.MAX_TILES_TO_MOD * 5)
  }

  private _startPos: Position = { x: 0, y: 0 }
  private _pos: Position = { x: 0, y: 0 }

  updateFiring(value: boolean): void {
    if (this.projectileDestroy) {
      this.projectileDestroy.active = value
      const destroyPos = this.scene.player.getProjectilePosition(0, this._pos)
      this.projectileDestroy.x = destroyPos.x
      this.projectileDestroy.y = destroyPos.y
    }

    this.processRestoreTiles()
  }

  protected onEnable() {
    this.initDestroyProjectile()
    this.scene.ui.matterMeter.setMatterTank(this.matterTank)
  }

  protected onDisable() {
    super.onDisable()
    this.scene.ui.matterMeter.setMatterTank(this.scene.player.matterTank)
  }

  private initDestroyProjectile() {
    if (this.projectileDestroy) return
    const availableCharge = this.matterTank.chargeAvailable(FireMode.DESTROY)
    const charge = Math.min(TunnelDestroyProjectile.MAX_TILES_TO_MOD, availableCharge)
    const startPos = this.scene.player.getProjectilePosition(0, this._startPos)
    this.projectileDestroy = this.scene.projectiles.add(TunnelDestroyProjectile, this.scene.player, this.matterTank, startPos.x, startPos.y, charge, FireMode.DESTROY)
  }

  private processRestoreTiles() {
    const dp = this.projectileDestroy
    const queue = dp?.sweepQueue
    if (!queue?.length) return

    const px = this.scene.player.x
    const py = this.scene.player.y
    const playerSafeRSq = (dp!.radius + PLAYER_SAFE_MARGIN) ** 2
    const available = this.matterTank.chargeAvailable(FireMode.CREATE)

    // Shared state across all records processed this frame.
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

      const dx = record.x - px
      const dy = record.y - py
      if (dx * dx + dy * dy <= playerSafeRSq) {
        queue[writeIdx++] = record
        continue
      }

      this._collectInto(record, result, visited, available)

      if (result.length >= available) {
        // Hit the matter cap: keep this record so the remaining tiles are created next time
        outOfMatter = true
        queue[writeIdx++] = record
      }
      // else: record fully processed — discard
    }
    queue.length = writeIdx

    if (result.length > 0) {
      this.applyRestoreCreate(result)
    }
  }

  private _collectInto(
    record: { x: number; y: number; radius: number },
    result: Tile[],
    visited: Set<number>,
    limit: number,
  ) {
    const { tilemap } = this.scene
    const { width } = tilemap
    const cx = Math.round(record.x)
    const cy = Math.round(record.y)
    const r = record.radius + 5

    tilemap.getCircle(cx, cy, r, (x, y) => {
      if (tilemap.getTile(x, y) !== TerrainType.EMPTY) return false
      const key = y * width + x
      if (visited.has(key)) return false
      visited.add(key)
      result.push({ x, y })
      return result.length >= limit  // stops getCircle iteration when limit reached
    }, true)
  }

  // Caller guarantees tiles.length <= chargeAvailable(CREATE)
  private applyRestoreCreate(tiles: Tile[]) {
    if (!tiles.length) return
    const created = this.scene.tilemap.applyCreateTiles(tiles)
    if (!created.length) return
    this.matterTank.addPendingCharge(FireMode.CREATE, created.length)
    const source = this.scene.player.matterParticleEmitPosition(this._emitPos)
    shuffleArray(created)
    const n = Math.min(created.length, MAX_RESTORE_PARTICLES)
    for (let i = 0; i < n; i++) {
      this.scene.particleManager.spawnMatter(source, created[i], true)
    }
    this.matterTank.applyPendingCharge(FireMode.CREATE, created.length)
  }

  protected onDestroy() {
    super.onDestroy()
    this.projectileDestroy?.destroy()
    this.projectileDestroy = null
  }
}
