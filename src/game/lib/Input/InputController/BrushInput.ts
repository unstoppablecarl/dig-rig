import { GameObjects, Input, Math as PMath, Scenes } from 'phaser'
import { BRUSH_OUTLINE_COLOR } from '../../../config/colors.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterType } from '../../Matter/_Matter.types.ts'
import { NO_MATTER_TANK_ID } from '../../Matter/Tank/_MatterTank.types.ts'
import { makeRestartableTimerEvent, RestartableTimerEvent } from '../../Util/RestartableTimerEvent.ts'
import { InputController } from './InputController.ts'
import POINTER_MOVE = Input.Events.POINTER_MOVE
import Pointer = Input.Pointer
import Vector2 = PMath.Vector2
import POST_UPDATE = Scenes.Events.POST_UPDATE

export class BrushInput extends InputController {
  public graphics: GameObjects.Graphics | null = null
  private _drawnRadius = -1
  private _drawnZoom = -1
  private _primaryTimer: RestartableTimerEvent
  private _secondaryTimer: RestartableTimerEvent

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.binderAdd(this.scene.input, POINTER_MOVE, this.pointermove)
    this.binderAdd(this.scene.events, POST_UPDATE, this.update)

    this._primaryTimer = makeRestartableTimerEvent(this.scene, {
      delay: 100,
      loop: true,
      callback: () => {
        this.brushPrimaryDown(this.scene.input.activePointer)
      },
    })

    this._secondaryTimer = makeRestartableTimerEvent(this.scene, {
      delay: 100,
      loop: true,
      callback: () => this.brushSecondaryDown(this.scene.input.activePointer),
    })

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
    const tx = Math.floor(x)
    const ty = Math.floor(y)
    const a = this.scene.playerActions
    const destroying = a.BRUSH_ERASE_MODIFIER.isDown()
    if (destroying) {
      this.brushDestroy(tx, ty)
    } else {
      this.brushCreate(tx, ty, this.scene.brushUIState.primaryMatterValue)
    }
  }

  protected brushSecondaryDown(p: Pointer) {
    const { x, y } = this.scene.cameras.main.getWorldPoint(p.x, p.y, this._worldPoint)
    const tx = Math.floor(x)
    const ty = Math.floor(y)
    this.brushCreate(tx, ty, this.scene.brushUIState.secondaryMatterValue)
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
    this.scene.matterEngine.brushAddMatter(type, tx, ty, radius)
  }

  brushDestroy(tx: number, ty: number) {
    const radius = this.scene.brushUIState.radius
    this.scene.matterEngine.brushEraseMatter(tx, ty, radius, NO_MATTER_TANK_ID)
  }

  protected onDestroy() {
    super.onDestroy()
    this._primaryTimer.destroy()
    this._secondaryTimer.destroy()
    this.graphics?.destroy()
    this.graphics = null
  }
}
