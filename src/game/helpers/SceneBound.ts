import type { Scene } from 'phaser'

export class SceneBound<T extends Scene = Scene> {
  constructor(
    public scene: T,
  ) {
    scene.events.once('destroy', this.destroy, this)
    scene.events.once('shutdown', this.destroy, this)
  }

  destroy() {
    this.scene.events.off('destroy', this.destroy, this)
    this.scene.events.off('shutdown', this.destroy, this)

    // @ts-expect-error: destroy
    this.scene = null
  }
}