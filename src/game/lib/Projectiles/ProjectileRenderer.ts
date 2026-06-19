import { BlendModes, GameObjects, Scenes } from 'phaser'
import { watch, type WatchHandle, type WatchSource } from 'vue'
import { FIRE_MODE_COLORS } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import type { BaseProjectile } from './BaseProjectile.ts'
import { tilesToRadius } from './projectile-radius.ts'
import type { ProjectileRendererPool } from './ProjectileRendererPool.ts'
import TweenBuilderConfig = Phaser.Types.Tweens.TweenBuilderConfig
import UPDATE = Scenes.Events.UPDATE

export class ProjectileRenderer extends SceneBound {
  protected fading = false

  readonly pool: ProjectileRendererPool | null
  // True while the renderer is sitting idle in the pool
  // should only be mutated by the ProjectileRendererPool
  _inPool = false
  readonly circle: GameObjects.Graphics
  readonly container: GameObjects.Container
  private _radius: number = 0
  private _color: number = 0
  private unBind: null | (() => void) = null
  private unWatchColor?: WatchHandle
  private unWatchCharge?: WatchHandle

  circleGlow1Visible = true
  circleGlow1Alpha = 0.8
  circleGlow2Visible = true
  circleGlow2Alpha = 0.2
  circleVisible = true
  circleAlpha = 0.8
  centerCircleVisible = true

  private _fadeOutAndDestroy: TweenBuilderConfig

  constructor(
    readonly scene: GameLevel,
    pool: ProjectileRendererPool | null = null,
    watchColorTarget?: WatchSource<number>,
    watchChargeTarget?: WatchSource<number>,
  ) {
    super(scene)
    this.pool = pool
    this.circle = scene.add.graphics().setBlendMode(BlendModes.ADD)

    this.container = scene.add.container().add(this.circle)
    scene.layers.projectile.add(this.container)

    this._fadeOutAndDestroy = {
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => this.destroy(),
    }

    if (watchColorTarget) {
      this.unWatchColor = watch(watchColorTarget, (value) => {
        this.setColor(value)
      }, { immediate: true, flush: 'sync' })
    }

    if (watchChargeTarget) {
      this.unWatchCharge = watch(watchChargeTarget, (value) => {
        const radius = tilesToRadius(value)
        this.setRadius(radius)
      }, { immediate: true, flush: 'sync' })
    }
  }

  override destroy() {
    if (this.destroyed || this._inPool) return
    if (this.pool && !this.pool.destroyed) {
      this._inPool = true
      this.pool.release(this)
    } else {
      super.destroy()
    }
  }

  reset(): void {
    this.unBind?.()
    this.unBind = null
    this.unWatchCharge?.()
    this.unWatchCharge = undefined
    this.unWatchColor?.()
    this.unWatchColor = undefined
    if (this.fading) {
      this.scene.tweens.killTweensOf(this.container)
      this.container.setAlpha(1)
    }
    this.fading = false
    this._radius = 0
    this._color = 0
    this.circleGlow1Visible = true
    this.circleGlow1Alpha = 0.8
    this.circleGlow2Visible = true
    this.circleGlow2Alpha = 0.2
    this.circleVisible = true
    this.circleAlpha = 0.8
    this.centerCircleVisible = true
    this.container.setVisible(false)
    this.container.active = false
    this.container.x = 0
    this.container.y = 0
    this.circle.clear()
  }

  attachToProjectile(projectile: BaseProjectile) {
    const scene = projectile.scene
    const color = FIRE_MODE_COLORS[projectile.effect.mode].color

    this.setVisible(true)
    this.setColor(color)

    const update = () => {
      if (projectile.destroyed || this.destroyed) {
        scene.events.off(UPDATE, update)
        return
      }

      this.setRadius(projectile.radius)
      this.setPosition(projectile)
    }
    this.setPosition(projectile)

    scene.events.on(UPDATE, update)
    this.unBind = () => scene.events.off(UPDATE, update)
  }

  setVisible(visible: boolean) {
    if (this.destroyed) return
    this.container.visible = visible
    this.container.active = visible
  }

  fadeOutAndDestroy(durationMS: number = 200) {
    this.fading = true
    this._fadeOutAndDestroy.duration = durationMS
    this.scene.add.tween(this._fadeOutAndDestroy)
  }

  setColor(color: number): void {
    if (color === this._color) return
    this._color = color
    this.draw()
  }

  get radius(): number {
    return this._radius
  }

  setRadius(radius: number) {
    if (radius === this._radius) return
    this._radius = radius
    this.draw()
  }

  setPosition(pos: Position) {
    this.container.x = pos.x
    this.container.y = pos.y
  }

  public draw() {
    if (this.destroyed) return
    const w = 1
    const radius = this._radius
    const color = this._color

    this.circle.clear()

    if (this.centerCircleVisible) {
      this.circle.lineStyle(0.5, 0xffffff, 0.8)
      this.circle.strokeCircle(0, 0, 1)
    }

    if (this.circleGlow1Visible) {
      this.circle.lineStyle(w * 2, color, this.circleGlow1Alpha)
      this.circle.strokeCircle(0, 0, radius + w * 2)
    }

    if (this.circleGlow2Visible) {
      this.circle.lineStyle(w * 4, color, this.circleGlow2Alpha)
      this.circle.strokeCircle(0, 0, radius + w * 4)
    }

    if (this.circleVisible) {
      this.circle.lineStyle(w * 0.5, 0xffffff, this.circleAlpha)
      this.circle.strokeCircle(0, 0, radius + w * 1.5)
    }
  }

  protected onDestroy() {
    this.circle.destroy(true)
    this.container.destroy(true)
    this.unBind?.()
    this.unBind = null

    this.unWatchCharge?.()
    this.unWatchColor?.()

    // @ts-expect-error: destroy
    this.circle = null
    // @ts-expect-error: destroy
    this.circleCenter = null
    // @ts-expect-error: destroy
    this.container = null
    // @ts-expect-error: destroy
    this.pool = null
  }
}

export function makePreviewProjectileRenderer(scene: GameLevel): ProjectileRenderer {
  const renderer = new ProjectileRenderer(scene, null, () => scene.weaponUIState.fireGroupColor, () => scene.weaponUIState.charge)
  renderer.circleGlow2Visible = false
  renderer.circleGlow1Alpha = 0.2
  renderer.circleAlpha = 0.3
  renderer.setVisible(false)
  renderer.draw()
  return renderer
}
