import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterType } from '../../Matter/_Matter.types.ts'
import type { VFXSettledTileData } from '../data/VFXSettledTileData.ts'

export class VFXSettledTileProcessor {

  constructor(
    private readonly scene: GameLevel,
    private readonly settledData: VFXSettledTileData,
  ) {
  }

  drain() {
    const { tilemapRenderer, matterRenderConfig, time } = this.scene
    const now = time.now
    const transitionColors = (matterRenderConfig as Partial<Record<MatterType, {
      settledTransitionColor?: Phaser.Display.Color
    }>>)

    this.settledData.drain((tx, ty, mt) => {
      const color = transitionColors[mt as MatterType]?.settledTransitionColor
      if (color) tilemapRenderer.addColorEffect(tx, ty, color, now)
    })
  }
}
