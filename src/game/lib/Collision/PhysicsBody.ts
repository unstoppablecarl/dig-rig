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

  private prevX = 0
  private prevY = 0
  private parent: PhysicsBodyManager | null = null

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
    const hasMovedX = this.prevX !== this.gameObject.x
    const hasMovedY = this.prevY !== this.gameObject.y
    const hasMoved = hasMovedX || hasMovedY

    if (!hasMoved) return

    const dx = this.gameObject.x - this.prevX
    const dy = this.gameObject.y - this.prevY

    this.scene.io.physicsBodies.syncFromBody(this.slotIdx, dx, dy, this.getPartVerts())

    this.prevX = this.gameObject.x
    this.prevY = this.gameObject.y
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