import type { Scene } from 'phaser'

export class SceneBound<T extends Scene = Scene> {
  private _destroyed = false

  get destroyed(): boolean {
    return this._destroyed
  }

  constructor(public scene: T) {
    scene.events.once('destroy', this.destroy, this)
    scene.events.once('shutdown', this.destroy, this)
  }

  // subclasses should not call this directly. Use onDestroy
  destroy() {
    if (this._destroyed) return
    this._destroyed = true
    this.scene?.events.off('destroy', this.destroy, this)
    this.scene?.events.off('shutdown', this.destroy, this)
    this.onDestroy()
    // @ts-expect-error: destroy
    this.scene = null
  }

  // Override this to release resources. this.scene is still set when called.
  protected onDestroy(): void {}
}
