import { BlendModes, GameObjects, Scenes } from 'phaser'
import { watchEffect } from 'vue'
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
  readonly circleCenter: GameObjects.Graphics | null = null
  readonly container: GameObjects.Container
  private _radius: number = 0
  private _color: number = 0
  private unBind: null | (() => void) = null
  circleGlow1Visible = true
  circleGlow1Alpha = 0.8

  circleGlow2Visible = true
  circleGlow2Alpha = 0.2

  circleVisible = true
  circleAlpha = 0.8

  constructor(
    readonly scene: GameLevel,
    drawCenterCircle = true,
  ) {
    super(scene)

    this.circle = scene.add.graphics().setBlendMode(BlendModes.ADD)

    this.container = scene.add.container().add(this.circle)
    scene.layers.projectile.add(this.container)

    if (drawCenterCircle) {
      this.circleCenter = scene.add.graphics().setBlendMode(BlendModes.ADD)
      this.container.add(this.circleCenter)

      this.circleCenter.lineStyle(0.5, 0xffffff, 0.8)
      this.circleCenter.strokeCircle(0, 0, 1)
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

    if (this.circleGlow1Visible) {
      this.circle.lineStyle(w * 2, color, this.circleGlow1Alpha)
      this.circle.strokeCircle(
        0,
        0,
        radius + w * 2,
      )
    }

    if (this.circleGlow2Visible) {
      this.circle.lineStyle(w * 4, color, this.circleGlow2Alpha)
      this.circle.strokeCircle(
        0,
        0,
        radius + w * 4,
      )
    }

    if (this.circleVisible) {
      this.circle.lineStyle(w * 0.5, 0xffffff, this.circleAlpha)
      this.circle.strokeCircle(
        0,
        0,
        radius + w * 1.5,
      )
    }
  }

  onDestroy() {
    this.circle.destroy(true)
    this.circleCenter?.destroy(true)
    this.container.destroy(true)
    this.unBind?.()
    this.unBind = null

    // @ts-expect-error: destroy
    this.circle = null
    // @ts-expect-error: destroy
    this.circleCenter = null
    // @ts-expect-error: destroy
    this.container = null
  }
}

export function makePreviewProjectileRenderer(scene: GameLevel) {
  const renderer = new ProjectileRenderer(scene, false)
  renderer.circleGlow2Visible = false
  renderer.circleGlow1Alpha = 0.2
  renderer.circleAlpha = 0.3

  watchEffect(() => {
    renderer.setColor(scene.weaponUIState.fireGroupColor)
  })

  watchEffect(() => {
    const charge = scene.weaponUIState.charge
    const radius = tilesToRadius(charge)
    renderer.setRadius(radius)
  })

  return renderer
}
