import { GameObjects, Input, Scenes } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterType } from '../../Matter/_Matter-types.ts'
import type { ProjectileEffectResult } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { PROJECTILE_EFFECT } from '../../Projectiles/ProjectileEffect/ProjectileEffect.ts'
import { applyEffect } from '../../Tilemap/TileMutation.ts'
import { InputController } from './InputController.ts'
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
  private _effectTiles: ProjectileEffectResult[] = []

  get matterType(): MatterType {
    return this.scene?.brushUIState?.matterType ?? MatterType.SOLID
  }

  set matterType(value: MatterType) {
    if (this.destroyed) return
    this.scene.brushUIState.matterType = value
  }

  constructor(
    public scene: GameLevel,
    private radius = 10,
    private minRadius = 1,
    private maxRadius = 30,
  ) {
    super(scene)
    this.graphics = this.scene.add.graphics()
    scene.layers.brush.add(this.graphics)
    this.binderAdd(this.scene.input, POINTER_MOVE, this.pointermove)
    this.binderAdd(this.scene.input, POINTER_DOWN, this.pointerdown)
    this.binderAdd(this.scene.input, POINTER_UP, this.pointerup)
    this.binderAdd(this.scene.events, UPDATE, this.update)
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

  onMouseWheel(deltaY: number) {
    if (deltaY > 0) {
      this.radius = Math.max(this.minRadius, this.radius - 1)
    } else {
      this.radius = Math.min(this.maxRadius, this.radius + 1)
    }
    this.brushDirty = true
    this.scene.brushUIState.radius = this.radius

    return true
  }

  update() {
    if (!this.brushDirty) return
    this.brushDirty = false
    this.graphics.clear()
    this.graphics.lineStyle(2, 0xffff00, 1)
    this.graphics.strokeCircle(this.mouseX, this.mouseY, this.radius)
  }

  apply(tileX: number, tileY: number) {
    if (this.matterType === MatterType.SOLID) {
      const effect = this.isCreating ? PROJECTILE_EFFECT.CREATE_SOLID : PROJECTILE_EFFECT.DESTROY
      applyEffect(this.scene.tilemap, this._effectTiles, tileX, tileY, this.radius, effect)
    } else {
      this.scene.matterBridge.addMatter(this.matterType, tileX, tileY, this.radius)
    }
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.graphics = null
  }
}
