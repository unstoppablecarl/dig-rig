import { GameObjects, Input, Scenes } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterType } from '../../Matter/_Matter-types.ts'
import type { ProjectileEffectResult } from '../../Projectiles/ProjectileEffect/_ProjectileEffect.types.ts'
import { PROJECTILE_EFFECT } from '../../Projectiles/ProjectileEffect/ProjectileEffect.ts'
import { applyEffect } from '../../Tilemap/TileMutation.ts'
import { InputController } from './InputController.ts'
import POINTER_MOVE = Input.Events.POINTER_MOVE
import Pointer = Input.Pointer
import UPDATE = Scenes.Events.UPDATE

export class BrushInput extends InputController {
  public graphics: GameObjects.Graphics
  private mouseX = 0
  private mouseY = 0
  private brushDirty = true
  private _effectTiles: ProjectileEffectResult[] = []

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
    this.graphics = this.scene.add.graphics()
    scene.layers.brush.add(this.graphics)
    this.binderAdd(this.scene.input, POINTER_MOVE, this.pointermove)
    this.binderAdd(this.scene.events, UPDATE, this.update)

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a.BRUSH_PRIMARY.onDown((e) => {
        const p = e as Pointer
        this.brushPrimaryDown(p)
      }),
      a.BRUSH_SECONDARY.onDown((e) => {
        const p = e as Pointer
        this.brushSecondaryDown(p)
      }),
    ])
  }

  protected onEnable() {
    this.graphics.setActive(true).setVisible(true)
  }

  protected onDisable() {
    this.graphics.setActive(false).setVisible(false)
  }

  protected brushPrimaryDown(p: Pointer) {
    const a = this.scene.playerActions
    const destroying = a.BRUSH_ERASE_MODIFIER.isDown()
    if (destroying) {
      this.brushDestroy(p.worldX, p.worldY)
    } else {
      this.brushCreate(p.worldX, p.worldY, this.primaryMatterType)
    }
  }

  protected brushSecondaryDown(p: Pointer) {
    this.brushCreate(p.worldX, p.worldY, this.secondaryMatterType)
  }

  pointermove(p: Pointer) {
    this.mouseX = p.worldX
    this.mouseY = p.worldY
    this.brushDirty = true

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
    this.brushDirty = true
    this.scene.brushUIState.radius = this.radius

    return true
  }

  update() {
    if (!this.brushDirty) return
    this.brushDirty = false
    this.graphics.clear()
    this.graphics.lineStyle(1, 0xffff00, 1)
    this.graphics.strokeCircle(this.mouseX, this.mouseY, this.radius)
  }

  brushCreate(tx: number, ty: number, type: MatterType) {
    this.scene.matterBridge.addMatter(type, tx, ty, this.radius)
  }

  brushDestroy(tx: number, ty: number) {
    applyEffect(this.scene.tilemap, this._effectTiles, tx, ty, this.radius, PROJECTILE_EFFECT.DESTROY)
  }

  protected onDestroy() {
    super.onDestroy()
    // @ts-expect-error: destroy
    this.graphics = null
  }
}
