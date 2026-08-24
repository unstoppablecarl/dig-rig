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

  // Shadow of physicsBodies.consumedGen[slotIdx] — see PhysicsBodiesData for
  // the full explanation. Starts at 0 to match the SharedArrayBuffer's
  // zero-initialized value; the pre-existing "huge first delta from prevX=0"
  // behavior on a body's very first update() is unaffected by this (that
  // already happens before any generation check would matter).
  private _lastConsumedGen = 0

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

    // If the coordinator has consumed our delta since we last checked, our
    // anchor is now "spent" — reset it to the current position so the next
    // delta starts counting from here, instead of re-reporting distance the
    // coordinator already accounted for.
    const gen = bridge.getConsumedGen(this.slotIdx)
    if (gen !== this._lastConsumedGen) {
      this._lastConsumedGen = gen
      this.prevX = this.gameObject.x
      this.prevY = this.gameObject.y
    }

    const hasMovedX = this.prevX !== this.gameObject.x
    const hasMovedY = this.prevY !== this.gameObject.y
    const hasMoved = hasMovedX || hasMovedY

    if (!hasMoved) return

    const dx = this.gameObject.x - this.prevX
    const dy = this.gameObject.y - this.prevY

    // NOTE: prevX/prevY are deliberately NOT reset here. Leaving the anchor
    // fixed until the coordinator confirms (via the generation counter) that
    // it has consumed this delta means dx/dy naturally accumulates across
    // however many render frames pass before the coordinator gets to this
    // slot again — under sim lag, that's the whole point: a single frame's
    // motion would otherwise silently overwrite and lose everything the body
    // moved through since the coordinator last looked.
    bridge.syncFromBody(this.slotIdx, dx, dy, this.getPartVerts())
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