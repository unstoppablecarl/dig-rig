import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import type { VFXTileEffectData } from '../../data/VFXTileEffectData.ts'
import Color = Phaser.Display.Color

export class VFXTileEffectProcessor {

  constructor(
    private readonly scene: GameLevel,
    private readonly data: VFXTileEffectData,
  ) {
  }

  private _color: Color = new Color()

  drain() {
    const { tilemapRenderer, time } = this.scene
    const now = time.now

    this.data.drain((tx, ty, colorInt) => {
      const color = Color.IntegerToColor(colorInt, this._color)
      tilemapRenderer.addColorEffect(tx, ty, color, now)
    })
  }
}
