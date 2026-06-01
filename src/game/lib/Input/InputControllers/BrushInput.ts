import { GameObjects, Input, Scenes } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { FireMode } from '../../Player/_FireMode-types'
import type { TileEffectResult } from '../../Tilemap/Tilemap.ts'
import { InputController } from './InputController.ts'
import GAMEOBJECT_POINTER_WHEEL = Input.Events.GAMEOBJECT_POINTER_WHEEL
import POINTER_DOWN = Input.Events.POINTER_DOWN
import POINTER_MOVE = Input.Events.POINTER_MOVE
import POINTER_UP = Input.Events.POINTER_UP
import Pointer = Input.Pointer
import UPDATE = Scenes.Events.UPDATE

export class BrushInput extends InputController {
  public graphics: GameObjects.Graphics
  private mouseX = 0
  private mouseY = 0
  private isDrawing = false
  private isCreating = false
  private brushDirty = true
  private _effectTiles: TileEffectResult[] = []

  constructor(
    public scene: GameLevel,
    private radius = 10,
    private minRadius = 1,
    private maxRadius = 30,
  ) {
    super(scene)
    this.graphics = this.scene.add.graphics()
    scene.layers.brush.add(this.graphics)
    this.addEvent(this.scene.input, POINTER_MOVE, this.pointermove)
    this.addEvent(this.scene.input, POINTER_DOWN, this.pointerdown)
    this.addEvent(this.scene.input, POINTER_UP, this.pointerup)
    this.addEvent(this.scene.input, GAMEOBJECT_POINTER_WHEEL, this.wheel)
    this.addEvent(this.scene.events, UPDATE, this.update)
  }

  protected onEnable() {
    this.graphics.setActive(true).setVisible(true)
  }

  protected onDisable() {
    this.graphics.setActive(false).setVisible(false)
  }

  pointermove(pointer: Pointer) {
    this.mouseX = pointer.worldX
    this.mouseY = pointer.worldY
    this.brushDirty = true

    if (this.isDrawing) {
      this.apply(this.mouseX, this.mouseY)
    }
  }

  pointerdown(pointer: Pointer) {
    this.isDrawing = true
    const destroying = (pointer.leftButtonDown() && pointer.event.shiftKey) || pointer.rightButtonDown()
    this.isCreating = !destroying
    this.apply(pointer.worldX, pointer.worldY)
  }

  pointerup() {
    this.isDrawing = false
  }

  wheel(_pointer: Pointer, _gameObjects: any, _deltaX: number, deltaY: number) {
    if (deltaY > 0) {
      this.radius = Math.max(this.minRadius, this.radius - 1)
    } else {
      this.radius = Math.min(this.maxRadius, this.radius + 1)
    }
    this.brushDirty = true
  }

  update() {
    if (!this.brushDirty) return
    this.brushDirty = false
    this.graphics.clear()
    this.graphics.lineStyle(4, 0xffff00, 1)
    this.graphics.strokeCircle(this.mouseX, this.mouseY, this.radius)
  }

  apply(tileX: number, tileY: number) {
    const newValue = this.isCreating ? FireMode.CREATE : FireMode.DESTROY
    this.scene.tilemap.applyEffect(this._effectTiles, tileX, tileY, this.radius, newValue, Number.MAX_VALUE)
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.graphics = null
  }
}
