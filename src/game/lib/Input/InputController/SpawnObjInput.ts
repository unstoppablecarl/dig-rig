import { GameObjects, Input, Math as PMath, Scenes } from 'phaser'
import { type SpawnObjUIState, useSpawnObjUIState } from '../../../../store/spawnObjUIState.ts'
import { BRUSH_OUTLINE_COLOR } from '../../../config/colors.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { InputController } from './InputController.ts'
import Pointer = Input.Pointer
import Vector2 = PMath.Vector2
import POST_UPDATE = Scenes.Events.POST_UPDATE

export class SpawnObjInput extends InputController {
  public graphics: GameObjects.Graphics | null = null
  private _drawnZoom = -1
  private state: SpawnObjUIState
  private _drawnW: number
  private _drawnH: number

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.binderAdd(this.scene.events, POST_UPDATE, this.update)

    const a = this.scene.playerActions
    this.binder.addInput(() => [
      a.BRUSH_PRIMARY.onDown((e) => {
        const p = e as Pointer
        this.spawnObj(p)

      }),
    ])

    this.state = useSpawnObjUIState()
  }

  protected onEnable() {
    this.graphics?.setActive(true).setVisible(true)
  }

  protected onDisable() {
    this.graphics?.setActive(false).setVisible(false)
  }

  _worldPoint = new Vector2()

  // spawnId is persisted globally, but each level registers its own entity set (see
  // GameLevel.registerEntities) — e.g. the default Crate isn't registered in LiquidPoolsTestLevel.
  // Fall back to the level's first registered spawner (or none) without overwriting the
  // persisted choice, so returning to a level that has it still selects it.
  private resolveSpawner() {
    const factory = this.scene.entityFactory
    return factory.get(this.state.spawnId) ?? factory.first()
  }

  protected spawnObj(p: Pointer) {
    const spawner = this.resolveSpawner()
    if (!spawner) return

    const { x, y } = this.scene.cameras.main.getWorldPoint(p.x, p.y, this._worldPoint)
    const tx = Math.floor(x)
    const ty = Math.floor(y)

    this.scene.entityFactory.spawnById(spawner.id, tx, ty)
  }

  update() {
    if (!this.graphics) {
      this.graphics = this.scene.ui.add.graphics()
    }
    const p = this.scene.input.activePointer
    const zoom = this.scene.cameras.main.zoom
    this.graphics.setPosition(p.x, p.y)

    const obj = this.resolveSpawner()
    if (!obj) {
      // Nothing spawnable in this level — no outline. Reset the cache so one is redrawn if
      // that changes.
      if (this._drawnZoom !== -1) this.graphics.clear()
      this._drawnZoom = -1
      return
    }
    const size = obj.size!

    const w = size.w
    const h = size.h

    if (zoom !== this._drawnZoom || w !== this._drawnW || h !== this._drawnH) {
      this._drawnZoom = zoom
      this._drawnW = w
      this._drawnH = h
      this.graphics.clear()
      this.graphics.lineStyle(1, BRUSH_OUTLINE_COLOR.color, 1)
      const width = w * zoom
      const height = h * zoom

      this.graphics.strokeRect(width * -0.5, height * -0.5, width, height)
    }
  }

  protected onDestroy() {
    super.onDestroy()
    this.graphics?.destroy()
    this.graphics = null
  }
}
