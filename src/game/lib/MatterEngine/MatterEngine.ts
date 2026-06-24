import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { MatterType } from '../Matter/_Matter.types.ts'
import type { MatterTankId } from '../Matter/Tank/_MatterTank.types.ts'
import { DataManager } from './DataManager.ts'
import { VFXParticleProcessor } from './processors/VFXParticleProcessor.ts'
import { VFXSettledTileProcessor } from './processors/VFXSettledTileProcessor.ts'
import type { CoordinatorInMsgBrushEraseMatter } from './workers/Coordinator.types.ts'
import { VFXTileEffectProcessor } from './workers/Coordinator/VFXTileEffectProcessor.ts'
import { CoordinatorController } from './workers/CoordinatorController.ts'

export type ApplyDestroyParams = Omit<CoordinatorInMsgBrushEraseMatter, 'type'>

export class MatterEngine extends SceneBound {
  private readonly worker: CoordinatorController

  private readonly vfxParticle: VFXParticleProcessor
  private readonly vfxSettled: VFXSettledTileProcessor
  private readonly vfxTileEffect: VFXTileEffectProcessor

  readonly data: DataManager

  constructor(public scene: GameLevel) {
    super(scene)

    const tilemap = this.scene.tilemap
    this.data = DataManager.make(tilemap)

    this.vfxParticle = new VFXParticleProcessor(
      scene,
      this.data.vfxParticleOverflow,
      this.data.vfxParticleDestroy,
      this.data.vfxParticleCreate,
    )
    this.vfxSettled = new VFXSettledTileProcessor(scene, this.data.vfxSettledTile)
    this.vfxTileEffect = new VFXTileEffectProcessor(scene, this.data.vfxTileEffect)

    this.worker = new CoordinatorController({
      ...this.data.buffers,
      width: tilemap.width,
      height: tilemap.height,
    })
  }

  brushEraseMatter(tx: number, ty: number, radius: number, ownerId: MatterTankId) {
    this.worker.brushEraseMatter(tx, ty, radius, ownerId)
  }

  brushAddMatter(value: MatterType, tx: number, ty: number, radius = 8) {
    this.worker.brushAddMatter(value, tx, ty, radius)
  }

  update() {
    if (this.destroyed) return
    const pixels = this.data.particle.consumePixels()
    if (pixels) {
      this.scene.tilemapRenderer.updateParticlePixels(pixels)
    }
    this.vfxSettled.drain()
    this.vfxParticle.drain()
    this.vfxTileEffect.drain()
  }

  protected onDestroy() {
    this.worker.terminate()
    // @ts-expect-error: destroy
    this.worker = null
  }
}
