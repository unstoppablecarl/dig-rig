import { type Scene, Scenes } from 'phaser'
import DESTROY = Scenes.Events.DESTROY
import SHUTDOWN = Scenes.Events.SHUTDOWN

export class SceneBound<T extends Scene = Scene> {
  private _destroyed = false

  get destroyed(): boolean {
    return this._destroyed
  }

  constructor(public scene: T) {
    scene.events.once(DESTROY, this.destroy, this)
    scene.events.once(SHUTDOWN, this.destroy, this)
  }

  // subclasses should not call this directly. Use onDestroy
  destroy() {
    if (this._destroyed) return
    this._destroyed = true
    this.scene?.events.off(DESTROY, this.destroy, this)
    this.scene?.events.off(SHUTDOWN, this.destroy, this)
    this.onDestroy()
    // @ts-expect-error: destroy
    this.scene = null
  }

  // Override this to release resources. this.scene is still set when called.
  protected onDestroy(): void {
  }
}
