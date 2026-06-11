import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../Matter/MatterTank/_MatterTank.types.ts'
import { ParticleType } from './_particle-types.ts'
import { ParticleWorkerInMsg, ParticleWorkerOutMsg, type TypedParticleWorker } from './ParticleSim.types.ts'
import ParticleWorkerConstructor from './ParticleSim.worker.ts?worker'

export class ParticleBridge extends SceneBound<GameLevel> {
  private readonly worker: TypedParticleWorker
  private readonly pixelSab: SharedArrayBuffer
  private readonly sabView: Uint8ClampedArray
  private readonly localBuf: Uint8Array

  onActivations?: (indices: number[]) => void

  constructor(scene: GameLevel) {
    super(scene)
    const { width, height } = scene.tilemap

    this.pixelSab = new SharedArrayBuffer(width * height * 4)
    this.sabView = new Uint8ClampedArray(this.pixelSab)
    this.localBuf = new Uint8Array(width * height * 4)

    this.worker = new ParticleWorkerConstructor() as TypedParticleWorker
    this.worker.postMessage({
      type: ParticleWorkerInMsg.INIT,
      tilesSab: scene.tilemap.tilesBuffer,
      pixelSab: this.pixelSab,
      width,
      height,
    })

    this.worker.onmessage = (e) => {
      if (e.data.type === ParticleWorkerOutMsg.ACTIVATIONS) {
        this.onActivations?.(e.data.indices)
      }
    }
  }

  spawn(type: ParticleType, x: number, y: number, ownerId: MatterTankId = NO_MATTER_TANK_ID) {
    this.worker.postMessage({ type: ParticleWorkerInMsg.SPAWN, particleType: type, x, y, ownerId })
  }

  update() {
    this.localBuf.set(this.sabView)
    this.scene.tilemapRenderer.updateParticlePixels(this.localBuf)
  }

  protected onDestroy() {
    this.worker.terminate()
    // @ts-expect-error: destroy
    this.worker = null
    // @ts-expect-error: destroy
    this.onActivations = null
  }
}
