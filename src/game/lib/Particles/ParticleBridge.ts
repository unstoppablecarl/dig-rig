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
  private readonly dirtyFlag: Int32Array

  private spawnBuf = new Int32Array(64 * 4)
  private spawnBufLen = 0

  onActivations?: (indices: number[]) => void

  constructor(scene: GameLevel) {
    super(scene)
    const { width, height } = scene.tilemap

    this.pixelSab = new SharedArrayBuffer(width * height * 4)
    this.sabView = new Uint8ClampedArray(this.pixelSab)
    this.localBuf = new Uint8Array(width * height * 4)

    // used as shareable boolean value
    const dirtySab = new SharedArrayBuffer(4)
    this.dirtyFlag = new Int32Array(dirtySab)

    this.worker = new ParticleWorkerConstructor() as TypedParticleWorker
    this.worker.postMessage({
      type: ParticleWorkerInMsg.INIT,
      tilesSab: scene.tilemap.tilesBuffer,
      pixelSab: this.pixelSab,
      dirtySab,
      width,
      height,
    })

    this.worker.onmessage = (e) => {
      if (e.data.type === ParticleWorkerOutMsg.ACTIVATIONS) {
        this.onActivations?.(e.data.indices)
      }
    }
  }

  queueSpawn(type: ParticleType, x: number, y: number, ownerId?: MatterTankId) {
    const needed = this.spawnBufLen + 4
    if (needed > this.spawnBuf.length) {
      const bigger = new Int32Array(this.spawnBuf.length * 2)
      bigger.set(this.spawnBuf)
      this.spawnBuf = bigger
    }
    this.spawnBuf[this.spawnBufLen++] = type
    this.spawnBuf[this.spawnBufLen++] = x
    this.spawnBuf[this.spawnBufLen++] = y
    this.spawnBuf[this.spawnBufLen++] = ownerId ?? NO_MATTER_TANK_ID
  }

  update() {
    if (this.spawnBufLen > 0) {
      const len = this.spawnBufLen
      const buf = this.spawnBuf.buffer
      this.spawnBuf = new Int32Array(Math.max(64 * 4, len))
      this.spawnBufLen = 0
      this.worker.postMessage({ type: ParticleWorkerInMsg.SPAWN_BATCH, data: new Int32Array(buf, 0, len) }, [buf])
    }

    // if clean return early;
    // dirty, set to clean and continue.
    const wasDirty = Atomics.compareExchange(this.dirtyFlag, 0, 1, 0) === 0
    if (wasDirty) return
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
