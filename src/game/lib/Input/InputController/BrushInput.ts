import { GameObjects, Input, Math, Scenes } from 'phaser'
import { BRUSH_OUTLINE_COLOR } from '../../../config/colors.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterType } from '../../Matter/_Matter.types.ts'
import type { ProjectileEffectResult } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { PROJECTILE_EFFECT } from '../../Projectiles/ProjectileEffect/ProjectileEffect.ts'
import { applyEffect } from '../../Tilemap/TileMutation.ts'
import { RestartableTimerEvent } from '../../Util/RestartableTimerEvent.ts'
import { InputController } from './InputController.ts'
import POINTER_MOVE = Input.Events.POINTER_MOVE
import Pointer = Input.Pointer
import Vector2 = Math.Vector2
import POST_UPDATE = Scenes.Events.POST_UPDATE

export class BrushInput extends InputController {
  public graphics: GameObjects.Graphics | null = null
  private _effectTiles: ProjectileEffectResult[] = []
  private _drawnRadius = -1
  private _drawnZoom = -1
  private _primaryTimer: RestartableTimerEvent
  private _secondaryTimer: RestartableTimerEvent

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
  ) {
    super(scene)
    this.binderAdd(this.scene.input, POINTER_MOVE, this.pointermove)
    this.binderAdd(this.scene.events, POST_UPDATE, this.update)

    this._primaryTimer = new RestartableTimerEvent({
      delay: 100,
      loop: true,
      callback: () => this.brushPrimaryDown(this.scene.input.activePointer),
    })
    this.scene.time.addEvent(this._primaryTimer)

    this._secondaryTimer = new RestartableTimerEvent({
      delay: 100,
      loop: true,
      callback: () => this.brushSecondaryDown(this.scene.input.activePointer),
    })
    this.scene.time.addEvent(this._secondaryTimer)

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a.BRUSH_PRIMARY.onDown((e) => {
        if (a.BRUSH_SECONDARY.isDown()) return
        const p = e as Pointer
        this.brushPrimaryDown(p)
        this._primaryTimer.start()
      }),
      a.BRUSH_PRIMARY.onUp(() => {
        this._primaryTimer.stop()
        if (a.BRUSH_SECONDARY.isDown()) {
          this._secondaryTimer.start()
        }
      }),
      a.BRUSH_SECONDARY.onDown((e) => {
        if (a.BRUSH_PRIMARY.isDown()) return
        const p = e as Pointer
        this.brushSecondaryDown(p)
        this._secondaryTimer.start()
      }),
      a.BRUSH_SECONDARY.onUp(() => {
        this._secondaryTimer.stop()
        if (a.BRUSH_PRIMARY.isDown()) {
          this._primaryTimer.start()
        }
      }),
    ])
  }

  protected onEnable() {
    this.graphics?.setActive(true).setVisible(true)
  }

  protected onDisable() {
    this._primaryTimer.stop()
    this._secondaryTimer.stop()
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
    this.scene.brushUIState.radius += deltaY > 0 ? -1 : 1
    return true
  }

  update() {
    if (!this.graphics) {
      this.graphics = this.scene.ui.add.graphics()
    }
    const radius = this.scene.brushUIState.radius
    const p = this.scene.input.activePointer
    const zoom = this.scene.cameras.main.zoom
    this.graphics.setPosition(p.x, p.y)
    if (radius !== this._drawnRadius || zoom !== this._drawnZoom) {
      this._drawnRadius = radius
      this._drawnZoom = zoom
      this.graphics.clear()
      this.graphics.lineStyle(1, BRUSH_OUTLINE_COLOR.color, 1)
      this.graphics.strokeCircle(0, 0, radius * zoom)
    }
  }

  brushCreate(tx: number, ty: number, type: MatterType) {
    const radius = this.scene.brushUIState.radius
    this.scene.matterBridge.addMatter(type, tx, ty, radius)
  }

  brushDestroy(tx: number, ty: number) {
    const radius = this.scene.brushUIState.radius
    applyEffect(this.scene.tilemap, this._effectTiles, tx, ty, radius, PROJECTILE_EFFECT.DESTROY)
  }

  protected onDestroy() {
    super.onDestroy()
    this._primaryTimer.destroy()
    this._secondaryTimer.destroy()
    this.graphics?.destroy()
    this.graphics = null
  }
}
