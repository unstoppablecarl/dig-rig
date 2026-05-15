import { debounce, type DebouncedFunction } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { UIScene } from '../../scenes/Layers/UIScene.ts'
import { EVENT_MESSAGE } from '../events.ts'

export class Toaster extends SceneBound {
  private element: HTMLElement
  private queueFadeOut: DebouncedFunction<() => void>

  constructor(public scene: UIScene) {
    super(scene)

    this.element = document.getElementById('toaster-text')!

    this.queueFadeOut = debounce(() => {
      this.hide()
    }, 2000)

    this.scene.EVENTS.on(EVENT_MESSAGE, this.message, this)
  }

  message(text: string) {
    if (this.element.innerText !== text) {
      this.element.innerText = text
    }

    this.element.classList.add('show')
    this.queueFadeOut()
  }

  hide() {
    this.element.classList.remove('show')
  }

  protected onDestroy() {
    this.scene.EVENTS.off(EVENT_MESSAGE, this.message, this)
  }
}
