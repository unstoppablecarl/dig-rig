import { SceneBound } from '../../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../../scenes/GameLevel.ts'
import type { MatterTankId } from '../../../Matter/Tank/_MatterTank.types.ts'
import type { ParticleType } from '../../../Particles/_particle-types.ts'
import type { ParticleData } from '../../data/ParticleData.ts'
import { ParticleSpawnBuffer } from './ParticleSpawnBuffer.ts'
import { ParticleWorkerInMsg, ParticleWorkerOutMsg, type TypedParticleWorker } from './ParticleSim.types.ts'
import ParticleWorkerConstructor from './ParticleSim.worker.ts?worker'

export class ParticleSimController extends SceneBound<GameLevel> {
  private readonly worker: TypedParticleWorker
  private readonly data: ParticleData
  private readonly spawnBuffer = new ParticleSpawnBuffer()
  private readonly onActivations: (indices: number[]) => void

  constructor(scene: GameLevel, data: ParticleData, responders: {
    onActivations: (indices: number[]) => void
  }) {
    super(scene)
    const { width, height } = scene.tilemap

    this.data = data
    this.onActivations = responders.onActivations
    this.worker = new ParticleWorkerConstructor() as TypedParticleWorker
    this.worker.postMessage({
      type: ParticleWorkerInMsg.INIT,
      tiles: scene.tilemap.tilesBuffer,
      pixelsA: data.buffers.pixelsA,
      pixelsB: data.buffers.pixelsB,
      pendingSlot: data.buffers.pendingSlot,
      width,
      height,
    })

    this.worker.onmessage = (e) => {
      if (e.data.type === ParticleWorkerOutMsg.ACTIVATIONS) {
        this.onActivations(e.data.indices)
      }
    }
  }

  queueSpawn(type: ParticleType, x: number, y: number, ownerId?: MatterTankId) {
    this.spawnBuffer.push(type, x, y, ownerId)
  }

  update() {
    const batch = this.spawnBuffer.flush()
    if (batch) {
      this.worker.postMessage({ type: ParticleWorkerInMsg.SPAWN_BATCH, data: batch }, [batch.buffer])
    }

    const pixels = this.data.consumePixels()
    if (pixels) {
      this.scene.tilemapRenderer.updateParticlePixels(pixels)
    }
  }

  protected onDestroy() {
    this.worker.terminate()
    // @ts-expect-error: destroy
    this.worker = null
    // @ts-expect-error: destroy
    this.onActivations = null
  }
}
