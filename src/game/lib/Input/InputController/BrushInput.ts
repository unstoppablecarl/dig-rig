import { GameObjects, Input, Scenes } from 'phaser'
import { BRUSH_OUTLINE_COLOR } from '../../../config/colors.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterType } from '../../Matter/_Matter-types.ts'
import type { ProjectileEffectResult } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { PROJECTILE_EFFECT } from '../../Projectiles/ProjectileEffect/ProjectileEffect.ts'
import { applyEffect } from '../../Tilemap/TileMutation.ts'
import { InputController } from './InputController.ts'
import POINTER_MOVE = Input.Events.POINTER_MOVE
import Pointer = Input.Pointer
import Vector2 = Phaser.Math.Vector2
import POST_UPDATE = Scenes.Events.POST_UPDATE

export class BrushInput extends InputController {
  public graphics: GameObjects.Graphics | null = null
  private _effectTiles: ProjectileEffectResult[] = []
  private _drawnRadius = -1
  private _drawnZoom = -1
  private _repeatTimer: Phaser.Time.TimerEvent | null = null

  get primaryMatterType(): MatterType {
    return this.scene?.brushUIState?.primaryMatterType ?? MatterType.SOLID
  }

  set primaryMatterType(value: MatterType) {
    if (this.destroyed) return
    this.scene.brushUIState.primaryMatterType = value
  }

  get secondaryMatterType(): MatterType {
    return this.scene?.brushUIState?.secondaryMatterType ?? MatterType.SOLID
  }

  set secondaryMatterType(value: MatterType) {
    if (this.destroyed) return
    this.scene.brushUIState.secondaryMatterType = value
  }

  constructor(
    public scene: GameLevel,
    private radius = 10,
    private minRadius = 1,
    private maxRadius = 30,
  ) {
    super(scene)
    this.binderAdd(this.scene.input, POINTER_MOVE, this.pointermove)
    this.binderAdd(this.scene.events, POST_UPDATE, this.update)

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a.BRUSH_PRIMARY.onDown((e) => {
        const p = e as Pointer
        this.brushPrimaryDown(p)
        this._repeatTimer = this.scene.time.addEvent({
          delay: 100,
          loop: true,
          callback: () => this.brushPrimaryDown(this.scene.input.activePointer),
        })
      }),
      a.BRUSH_PRIMARY.onUp(() => {
        this._repeatTimer?.destroy()
        this._repeatTimer = null
      }),
      a.BRUSH_SECONDARY.onDown((e) => {
        const p = e as Pointer
        this.brushSecondaryDown(p)
      }),
    ])
  }

  protected onEnable() {
    this.graphics?.setActive(true).setVisible(true)
  }

  protected onDisable() {
    this.graphics?.setActive(false).setVisible(false)
  }

  _worldPoint = new Vector2()

  protected brushPrimaryDown(p: Pointer) {
    const { x, y } = this.scene.cameras.main.getWorldPoint(p.x, p.y, this._worldPoint)
    const a = this.scene.playerActions
    const destroying = a.BRUSH_ERASE_MODIFIER.isDown()
    if (destroying) {
      this.brushDestroy(x, y)
    } else {
      this.brushCreate(x, y, this.primaryMatterType)
    }
  }

  protected brushSecondaryDown(p: Pointer) {
    const { x, y } = this.scene.cameras.main.getWorldPoint(p.x, p.y, this._worldPoint)
    this.brushCreate(x, y, this.secondaryMatterType)
  }

  pointermove(p: Pointer) {
    const a = this.scene.playerActions
    if (a.BRUSH_PRIMARY.isDown()) {
      this.brushPrimaryDown(p)
    } else if (a.BRUSH_SECONDARY.isDown()) {
      this.brushSecondaryDown(p)
    }
  }

  onMouseWheel(deltaY: number) {
    if (deltaY > 0) {
      this.radius = Math.max(this.minRadius, this.radius - 1)
    } else {
      this.radius = Math.min(this.maxRadius, this.radius + 1)
    }
    this.scene.brushUIState.radius = this.radius

    return true
  }

  update() {
    if (!this.graphics) {
      this.graphics = this.scene.ui.add.graphics()
    }
    const p = this.scene.input.activePointer
    const zoom = this.scene.cameras.main.zoom
    this.graphics.setPosition(p.x, p.y)
    if (this.radius !== this._drawnRadius || zoom !== this._drawnZoom) {
      this._drawnRadius = this.radius
      this._drawnZoom = zoom
      this.graphics.clear()
      this.graphics.lineStyle(1, BRUSH_OUTLINE_COLOR.color, 1)
      this.graphics.strokeCircle(0, 0, this.radius * zoom)
    }
  }

  brushCreate(tx: number, ty: number, type: MatterType) {
    this.scene.matterBridge.addMatter(type, tx, ty, this.radius)
  }

  brushDestroy(tx: number, ty: number) {
    applyEffect(this.scene.tilemap, this._effectTiles, tx, ty, this.radius, PROJECTILE_EFFECT.DESTROY)
  }

  protected onDestroy() {
    super.onDestroy()
    this._repeatTimer?.destroy()
    this._repeatTimer = null
    this.graphics?.destroy()
    this.graphics = null
  }
}
