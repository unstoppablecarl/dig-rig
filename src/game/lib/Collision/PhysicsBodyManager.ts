import type { BodyType } from 'matter'
import { BasicManager } from '../Util/BasicManager.ts'
import type { PhysicsBodyType } from './_Collision.types.ts'
import { PhysicsBody } from './PhysicsBody.ts'
import Container = Phaser.GameObjects.Container
import Image = Phaser.GameObjects.Image
import Sprite = Phaser.GameObjects.Sprite

export class PhysicsBodyManager extends BasicManager<PhysicsBody> {

  register(gameObject: Image & Sprite & PhysicsBodyType): PhysicsBody {
    const data = this.scene.io.physicsBodies
    const slotIdx = data.acquire()
    if (slotIdx < 0) throw new Error('physics bodies full')
    const body = new PhysicsBody(this.scene, gameObject, slotIdx)
    data.registerPending(body)
    this.add(body)
    return body
  }

  registerFromContainer(container: Container, body: BodyType) {
    const obj = this.scene.matter.add.gameObject(container, body) as unknown as Image & Sprite & Container & PhysicsBodyType
    return this.register(obj)
  }

  registerFromSprite(sprite: Sprite, body: BodyType) {
    const obj = this.scene.matter.add.gameObject(sprite, body) as unknown as Image & Sprite & PhysicsBodyType
    return this.register(obj)
  }

  remove(body: PhysicsBody) {
    // already destroyed
    if (!this.children) return
    if (body.slotIdx >= 0) {
      const data = this.scene.io.physicsBodies
      data.destroy(body.slotIdx)
    }
    super.remove(body)
  }

  protected onDestroy() {
    for (const body of this.children) {
      this.remove(body)
    }
    // @ts-expect-error: destroy
    this.children = null
  }
}