import { BlendModes, GameObjects } from 'phaser'
import { PROJECTILE_MODE_COLORS } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import type { BaseProjectile } from './BaseProjectile.ts'
import UPDATE = Phaser.Input.Events.UPDATE

export class ProjectileRenderer extends SceneBound {
  protected fading = false

  private circle: GameObjects.Graphics
  private circleCenter: GameObjects.Graphics
  private container: GameObjects.Container

  constructor(
    readonly scene: GameLevel,
    private _color: number = 0,
    private _radius: number = 0,
  ) {
    super(scene)

    this.circle = scene.add.graphics().setBlendMode(BlendModes.ADD)
    this.circleCenter = scene.add.graphics().setBlendMode(BlendModes.ADD)

    this.container = scene.add.container().add([this.circle, this.circleCenter])
    scene.layers.projectile.add(this.container)

    this.circleCenter.lineStyle(0.5, 0xffffff, 0.8)
    this.circleCenter.strokeCircle(0, 0, 1)
  }

  attachToProjectile(projectile: BaseProjectile) {
    const scene = projectile.scene
    const color = PROJECTILE_MODE_COLORS[projectile.mode]

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
  }

  setVisible(visible: boolean) {
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
    const w = 1
    const radius = this._radius
    const color = this._color

    this.circle.clear()

    this.circle.lineStyle(w * 2, color, 0.8)
    this.circle.strokeCircle(
      0,
      0,
      radius + w * 2,
    )

    this.circle.lineStyle(w * 4, color, 0.2)
    this.circle.strokeCircle(
      0,
      0,
      radius + w * 4,
    )

    this.circle.lineStyle(w * 0.5, 0xffffff, 0.8)
    this.circle.strokeCircle(
      0,
      0,
      radius + w * 1.5,
    )

  }

  onDestroy() {
    this.circle.destroy(true)
    this.circleCenter.destroy(true)
    this.container.destroy(true)

    // @ts-expect-error: destroy
    this.circle = null
    // @ts-expect-error: destroy
    this.circleCenter = null
    // @ts-expect-error: destroy
    this.container = null
  }
}
