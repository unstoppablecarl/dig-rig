import { GameObjects, Input, Scenes } from 'phaser'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { TerrainType } from '../TileMap/TileMap.ts'
import type { InputController } from './InputManager.ts'
import GAMEOBJECT_POINTER_WHEEL = Input.Events.GAMEOBJECT_POINTER_WHEEL
import POINTER_DOWN = Input.Events.POINTER_DOWN
import POINTER_MOVE = Input.Events.POINTER_MOVE
import POINTER_UP = Input.Events.POINTER_UP

import Pointer = Input.Pointer
import UPDATE = Scenes.Events.UPDATE

export class BrushInput extends SceneBound implements InputController {
  public graphics: GameObjects.Graphics
  private mouseX = 0
  private mouseY = 0
  private isDrawing = false
  private isCreating = false
  private brushDirty = true
  private _enabled = false

  constructor(
    public scene: GameLevel,
    private radius = 10,
    private minRadius = 1,
    private maxRadius = 30,
  ) {
    super(scene)
    this.graphics = this.scene.add.graphics()

    scene.layers.brush.add(this.graphics)
  }

  get enabled() {
    return this._enabled
  }

  setInputEnabled(value: boolean) {
    if (this._enabled === value) return

    if (value) {
      this.scene.input.on(POINTER_MOVE, this.pointermove, this)
      this.scene.input.on(POINTER_DOWN, this.pointerdown, this)
      this.scene.input.on(POINTER_UP, this.pointerup, this)
      this.scene.input.on(GAMEOBJECT_POINTER_WHEEL, this.wheel, this)
      this.scene.events.on(UPDATE, this.update, this)

      this.graphics.setActive(true).setVisible(true)
    } else {
      this.scene.input.off(POINTER_MOVE, this.pointermove, this)
      this.scene.input.off(POINTER_DOWN, this.pointerdown, this)
      this.scene.input.off(POINTER_UP, this.pointerup, this)
      this.scene.input.off(GAMEOBJECT_POINTER_WHEEL, this.wheel, this)
      this.scene.events.off(UPDATE, this.update, this)

      this.graphics.setActive(false).setVisible(false)
    }
    this._enabled = value
  }

  pointermove(pointer: Pointer) {
    this.mouseX = pointer.worldX
    this.mouseY = pointer.worldY
    this.brushDirty = true

    // dragging
    if (this.isDrawing) {
      const tileX = this.mouseX
      const tileY = this.mouseY

      this.apply(tileX, tileY)
    }
  }

  pointerdown(pointer: Pointer) {
    this.isDrawing = true
    const destroying = (pointer.leftButtonDown() && pointer.event.shiftKey) || pointer.rightButtonDown()
    this.isCreating = !destroying

    const tileX = pointer.worldX
    const tileY = pointer.worldY

    this.apply(tileX, tileY)
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
    let newValue = TerrainType.EMPTY
    if (this.isCreating) {
      newValue = TerrainType.SOLID
    }

    this.scene.tilemap.applyEffect(tileX, tileY, this.radius, newValue, Number.MAX_VALUE)
  }

  protected onDestroy() {
    this.setInputEnabled(false)
    // @ts-expect-error: destroy
    this.graphics = null
  }
}
