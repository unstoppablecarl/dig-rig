import { BlendModes, GameObjects } from 'phaser'
import { PROJECTILE_MODE_COLORS } from '../../config.ts'
import type { BaseProjectile } from './BaseProjectile.ts'

export class ProjectileRenderer {
  public fading = false
  public dirty = true
  public destroyed = false

  private circle: GameObjects.Graphics
  private circleCenter: GameObjects.Graphics
  private container: GameObjects.Container

  constructor(
    public projectile: BaseProjectile,
  ) {
    const scene = projectile.scene
    this.circle = scene.add.graphics().setBlendMode(BlendModes.ADD)
    this.circleCenter = scene.add.graphics().setBlendMode(BlendModes.ADD)

    this.container = scene.add.container().add([this.circle, this.circleCenter])
    scene.layers.projectile.add(this.container)

    this.circleCenter.lineStyle(0.5, 0xffffff, 0.8)
    this.circleCenter.strokeCircle(0, 0, 1)
  }

  queueReRender() {
    this.dirty = true
  }

  fadeOutAndDestroy() {
    this.fading = true
    this.projectile.scene.add.tween({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => this.destroy(),
    })
  }

  update(pos: { x: number, y: number }) {
    if (this.destroyed || this.fading) return
    this.container.x = pos.x
    this.container.y = pos.y

    if (!this.dirty) return

    const modeColor = PROJECTILE_MODE_COLORS[this.projectile.mode]
    const w = 1
    let radius = this.projectile.radius

    this.circle.clear()

    this.circle.lineStyle(w * 2, modeColor, 0.8)
    this.circle.strokeCircle(
      0,
      0,
      radius + w * 2,
    )

    this.circle.lineStyle(w * 4, modeColor, 0.2)
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

    this.dirty = false
  }

  destroy() {
    if (this.destroyed) return
    this.circle.destroy(true)
    this.circleCenter.destroy(true)
    this.container.destroy(true)

    // @ts-expect-error: destroy
    this.circle = null
    // @ts-expect-error: destroy
    this.circleCenter = null
    // @ts-expect-error: destroy
    this.container = null

    this.destroyed = true
  }
}