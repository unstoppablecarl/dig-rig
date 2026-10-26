import type { BodyType } from 'matter'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { type ManagerItem } from '../Util/BasicManager.ts'
import type { PhysicsBodyType, RectVerts } from './_Collision.types.ts'
import type { PhysicsBodyManager } from './PhysicsBodyManager.ts'
import Image = Phaser.GameObjects.Image
import Sprite = Phaser.GameObjects.Sprite

type PhysicsBodyArgs = ConstructorParameters<typeof PhysicsBody>;

export type PhysicsBodyConstructor<T extends PhysicsBody> = new (...args: PhysicsBodyArgs) => T;

export class PhysicsBody extends SceneBound<GameLevel> implements ManagerItem<PhysicsBodyManager> {

  // Anchor: the position the coordinator last consumed. deltaX/deltaY are measured from here.
  private prevX = 0
  private prevY = 0
  private parent: PhysicsBodyManager | null = null

  // Position reported with each sync, indexed by its (wrapping, 8-bit) syncSeq — when the
  // coordinator reports which sync it consumed (consumedSeq), re-anchor to exactly the position
  // that sync described. Re-anchoring to the *current* position instead dropped any motion
  // since the last sync (the body has already moved again by the time update() notices), so
  // that stretch of the path was never swept.
  private readonly syncedX = new Float64Array(256)
  private readonly syncedY = new Float64Array(256)
  private lastSyncedX = 0
  private lastSyncedY = 0
  private lastConsumedSeq = -1
  // False until the first update() — the anchor starts at the body's own spawn position, not
  // (0, 0), which made the first delta sweep (and displace liquid) all the way from the origin.
  private anchored = false

  setManager(parent: PhysicsBodyManager) {
    this.parent = parent
  }

  constructor(
    scene: GameLevel,
    readonly gameObject: Image & Sprite & PhysicsBodyType,
    readonly slotIdx: number,
  ) {
    super(scene)
    const body = this.gameObject.body as BodyType
    scene.terrainChunkBodyManager.track(body)
  }

  update(): void {
    const bridge = this.scene.io.physicsBodies
    const x = this.gameObject.x
    const y = this.gameObject.y

    if (!this.anchored) {
      this.anchored = true
      this.prevX = x
      this.prevY = y
      // A reused slot still holds the previous body's consumedSeq.
      this.lastConsumedSeq = bridge.getConsumedSeq(this.slotIdx)
      // Sync once even at rest, so the coordinator stamps the body's footprint.
      this.sync(x, y)
      return
    }

    const consumed = bridge.getConsumedSeq(this.slotIdx)
    if (consumed !== this.lastConsumedSeq) {
      this.lastConsumedSeq = consumed
      this.prevX = this.syncedX[consumed]
      this.prevY = this.syncedY[consumed]
    }

    // Nothing new since the last sync. The anchor is deliberately NOT moved forward here:
    // until the coordinator confirms (via consumedSeq) what it has swept, dx/dy keep
    // accumulating from the anchor, so a lagging coordinator still sees the whole path.
    if (x === this.lastSyncedX && y === this.lastSyncedY) return

    this.sync(x, y)
  }

  private sync(x: number, y: number) {
    const seq = this.scene.io.physicsBodies.syncFromBody(this.slotIdx, x - this.prevX, y - this.prevY, this.getPartVerts())
    this.syncedX[seq] = x
    this.syncedY[seq] = y
    this.lastSyncedX = x
    this.lastSyncedY = y
  }

  getPartVerts() {
    const body = this.gameObject.body as BodyType

    const isCompound = body.parts.length > 1
    if (isCompound) {
      throw new Error('compound not implemented')
    }

    return body.parts[0].vertices! as RectVerts
  }

  protected onDestroy(): void {
    const body = this.gameObject.body as BodyType
    this.scene?.terrainChunkBodyManager?.untrack?.(body)
    this.parent?.remove?.(this)
  }
}