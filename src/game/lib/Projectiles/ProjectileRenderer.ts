import { BlendModes, GameObjects, Scenes } from 'phaser'
import { watch, type WatchHandle, type WatchSource } from 'vue'
import { FIRE_MODE_COLORS } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import type { BaseProjectile } from './BaseProjectile.ts'
import { tilesToRadius } from './projectile-radius.ts'
import UPDATE = Scenes.Events.UPDATE

export class ProjectileRenderer extends SceneBound {
  protected fading = false

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

  constructor(
    readonly scene: GameLevel,
    watchColorTarget?: WatchSource<number>,
    watchChargeTarget?: WatchSource<number>,
  ) {
    super(scene)

    this.circle = scene.add.graphics().setBlendMode(BlendModes.ADD)

    this.container = scene.add.container().add(this.circle)
    scene.layers.projectile.add(this.container)

    if (watchColorTarget) {
      this.unWatchColor = watch(watchColorTarget, (value) => {
        this.setColor(value)
      }, { immediate: true })
    }

    if (watchChargeTarget) {
      this.unWatchCharge = watch(watchChargeTarget, (value) => {
        const radius = tilesToRadius(value)
        this.setRadius(radius)
      }, { immediate: true })
    }
  }

  attachToProjectile(projectile: BaseProjectile) {
    const scene = projectile.scene
    const color = FIRE_MODE_COLORS[projectile.mode]

    this.setColor(color)

    const update = () => {
      if (projectile.destroyed) {
        this.destroy()
      }
      if (this.destroyed) {
        scene.events.off(UPDATE, update)
        return
      }

      this.setRadius(projectile.radius)
      this.setPosition(projectile)
    }

    scene.events.on(UPDATE, update)
    this.unBind = () => scene.events.off(UPDATE, update)
  }

  setVisible(visible: boolean) {
    if (this.destroyed) return
    this.container.visible = visible
    this.container.active = visible
  }

  fadeOutAndDestroy() {
    this.fading = true
    this.scene.add.tween({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => this.destroy(),
    })
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

  private draw() {
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
  }
}

export function makePreviewProjectileRenderer(scene: GameLevel) {
  const renderer = new ProjectileRenderer(scene, () => scene.weaponUIState.fireGroupColor, () => scene.weaponUIState.charge)
  renderer.circleGlow2Visible = false
  renderer.circleGlow1Alpha = 0.2
  renderer.circleAlpha = 0.3

  return renderer
}
