import type { BodyType } from 'matter'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { EMPTY, matterType, PHYSICS_BODY } from '../Matter/_Matter.types.ts'
import type { PhysicsBodyType } from './_Collision.types.ts'
import type { PhysicsBodyManager } from './PhysicsBodyManager.ts'
import Container = Phaser.GameObjects.Container
import Image = Phaser.GameObjects.Image
import Sprite = Phaser.GameObjects.Sprite

export class PhysicsBody extends SceneBound<GameLevel> {
  /** Tile indices stamped as PHYSICS_BODY last step — cleared and re-stamped each step. */
  private readonly prevTiles: number[] = []

  private prevX = 0
  private prevY = 0

  static makeFromSprite(scene: GameLevel, sprite: Sprite, body: BodyType): PhysicsBody {
    const obj = scene.matter.add.gameObject(sprite, body) as unknown as Image & Sprite & PhysicsBodyType

    return new PhysicsBody(scene, obj)
  }

  static makeFromContainer(scene: GameLevel, container: Container, body: BodyType) {
    const obj = scene.matter.add.gameObject(container, body) as unknown as Image & Sprite & Container & PhysicsBodyType
    return new PhysicsBody(scene, obj)
  }

  private parent: PhysicsBodyManager | null = null

  setParent(parent: PhysicsBodyManager) {
    this.parent = parent
  }

  constructor(
    scene: GameLevel,
    readonly gameObject: Image & Sprite & PhysicsBodyType,
  ) {
    super(scene)

    scene.terrainChunkBodyManager.track(this.gameObject.body as BodyType)
  }

  update(): void {
    const hasMoved = this.prevX !== this.gameObject.x || this.prevY !== this.gameObject.y
    if (!hasMoved) return

    this.clearPrevTiles()
    this.rasterize()
    this.prevX = this.gameObject.x
    this.prevY = this.gameObject.y
  }

  private clearPrevTiles(): void {
    const { tiles, width, chunkGrid } = this.scene.tilemap

    for (const idx of this.prevTiles) {
      if (matterType(tiles[idx]) === PHYSICS_BODY) {
        tiles[idx] = EMPTY
        const ty = (idx / width) | 0
        const tx = idx - ty * width
        chunkGrid.markRenderDirtyTile(tx, ty)
      }
    }
    this.prevTiles.length = 0
  }

  private rasterize(): void {
    const body = this.gameObject.body as BodyType
    const { tiles, width, height, chunkGrid } = this.scene.tilemap

    // For compound bodies parts[0] is the parent shell; actual geometry is in parts[1...].
    // For single bodies parts[0] is the body itself.
    const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts

    for (const part of parts) {
      const verts = part.vertices
      if (!verts || verts.length < 3) continue

      let minX = verts[0].x, maxX = verts[0].x
      let minY = verts[0].y, maxY = verts[0].y
      for (let i = 1; i < verts.length; i++) {
        if (verts[i].x < minX) minX = verts[i].x
        if (verts[i].x > maxX) maxX = verts[i].x
        if (verts[i].y < minY) minY = verts[i].y
        if (verts[i].y > maxY) maxY = verts[i].y
      }

      const tx0 = Math.max(0, Math.floor(minX))
      const ty0 = Math.max(0, Math.floor(minY))
      const tx1 = Math.min(width - 1, Math.ceil(maxX))
      const ty1 = Math.min(height - 1, Math.ceil(maxY))

      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (!pointInConvex(tx + 0.5, ty + 0.5, verts)) continue
          const idx = ty * width + tx
          const type = matterType(tiles[idx])
          if (type !== EMPTY && type !== PHYSICS_BODY) continue
          tiles[idx] = PHYSICS_BODY
          chunkGrid.markRenderDirtyTile(tx, ty)
          this.prevTiles.push(idx)
        }
      }
    }
  }

  protected onDestroy(): void {
    this.clearPrevTiles()
    this.scene.terrainChunkBodyManager.untrack(this.gameObject.body as BodyType)
    this.parent?.remove(this)
  }
}

// matter.js specific algo
function pointInConvex(px: number, py: number, verts: { x: number; y: number }[]): boolean {
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]
    const b = verts[(i + 1) % verts.length]
    if ((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x) < 0) return false
  }
  return true
}
