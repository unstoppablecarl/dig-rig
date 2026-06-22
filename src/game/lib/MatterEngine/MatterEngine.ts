import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { MatterType } from '../Matter/_Matter.types.ts'
import { DataManager } from './DataManager.ts'
import { VFXParticleProcessor } from './processors/VFXParticleProcessor.ts'
import { VFXSettledTileProcessor } from './processors/VFXSettledTileProcessor.ts'
import type { CoordinatorInMsgBrushEraseMatter } from './workers/Coordinator.types.ts'
import { VFXTileEffect } from './workers/Coordinator/VFXTileEffect.ts'
import { CoordinatorController } from './workers/CoordinatorController.ts'
import { ParticleSimController } from './workers/ParticleSim/ParticleSimController.ts'

export type ApplyDestroyParams = Omit<CoordinatorInMsgBrushEraseMatter, 'type'>

export class MatterEngine extends SceneBound {
  private readonly workerController: CoordinatorController
  private readonly particleSim: ParticleSimController
  private readonly vfxParticle: VFXParticleProcessor
  private readonly vfxSettled: VFXSettledTileProcessor
  private readonly vfxTileEffect: VFXTileEffect

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
    this.vfxTileEffect = new VFXTileEffect(scene, this.data.vfxTileEffect)

    this.particleSim = new ParticleSimController(this.scene, this.data.particle, {
      onActivations: (indices) => this.workerController.activateTiles(indices),
    })

    this.workerController = new CoordinatorController({
      ...this.data.buffers,
      width: tilemap.width,
      height: tilemap.height,
    }, {
      spawnParticle: (particleType, x, y, ownerId) => {
        this.particleSim.queueSpawn(particleType, x, y, ownerId)
      },
    })
  }

  brushEraseMatter(params: ApplyDestroyParams) {
    this.workerController.brushEraseMatter(params)
  }

  brushAddMatter(value: MatterType, tx: number, ty: number, radius = 8) {
    this.workerController.brushAddMatter(value, Math.floor(tx), Math.floor(ty), radius)
  }

  update() {
    if (this.destroyed) return
    this.particleSim.update()
    this.vfxSettled.drain()
    this.vfxParticle.drain()
    this.vfxTileEffect.drain()
  }

  protected onDestroy() {
    this.workerController.terminate()
    // @ts-expect-error: destroy
    this.workerController = null
  }
}
