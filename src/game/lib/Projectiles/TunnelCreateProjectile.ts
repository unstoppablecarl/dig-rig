import { Time } from 'phaser'
import { EMPTY } from '../Matter/_Matter-types.ts'

import { FireMode } from '../Player/_FireMode-types'
import type { Tile } from '../Tilemap/Tilemap.ts'
import { BaseProjectile } from './BaseProjectile.ts'
import TimerEvent = Time.TimerEvent

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const

export class TunnelCreateProjectile extends BaseProjectile {
  public expandRateMs = 10
  private expandTimer: TimerEvent | null = null
  private _frontier: Tile[] = []
  private _frontierHead = 0
  private _queued = new Set<number>()

  public fireInPlace() {
    this.fired = true
    this.matterTank.addPendingCharge(FireMode.CREATE, this.tilesToModify)
    this._enqueue(Math.round(this.x), Math.round(this.y))
    this.expandTimer = this.startExpandTimer()
  }

  update(_dt: number) {
  }

  public startExpandTimer() {
    return this.scene.time.addEvent({
      delay: this.expandRateMs,
      callbackScope: this,
      loop: true,
      callback: this.expandAndCreate,
    })
  }

  private _enqueue(x: number, y: number) {
    const { width, height } = this.scene.tilemap
    if (x < 0 || x >= width || y < 0 || y >= height) return
    const key = y * width + x
    if (this._queued.has(key)) return
    if (this.scene.tilemap.getTile(x, y) !== EMPTY) return
    this._queued.add(key)
    this._frontier.push({ x, y })
  }

  private expandAndCreate() {
    if (this.destroyed) return

    const budget = this.charge()
    if (budget <= 0 || this._frontierHead >= this._frontier.length) {
      this.destroy()
      return
    }

    const vel = this.scene.player.container.body?.velocity
    const vx = vel?.x ?? 0
    const vy = vel?.y ?? 0
    const vlen = Math.sqrt(vx * vx + vy * vy)
    let fdx: number, fdy: number
    if (vlen > 1) {
      fdx = vx / vlen
      fdy = vy / vlen
    } else {
      const aim = this.scene.player.getProjectileAngle()
      fdx = Math.cos(aim)
      fdy = Math.sin(aim)
    }
    const px = this.scene.player.x
    const py = this.scene.player.y

    const { width, height } = this.scene.tilemap
    const toCreate: Tile[] = []

    while (this._frontierHead < this._frontier.length && toCreate.length < budget) {
      const { x, y } = this._frontier[this._frontierHead++]

      if (this.scene.tilemap.getTile(x, y) !== EMPTY) continue
      if ((x - px) * fdx + (y - py) * fdy > 0) continue

      toCreate.push({ x, y })

      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        if ((nx - px) * fdx + (ny - py) * fdy > 0) continue
        this._enqueue(nx, ny)
      }
    }

    if (!toCreate.length) {
      if (this._frontierHead >= this._frontier.length) this.destroy()
      return
    }
  }

  protected onDestroy() {
    this.expandTimer?.destroy()
    this.expandTimer = null
    this._frontier.length = 0
    this._queued.clear()
    super.onDestroy()
  }
}
