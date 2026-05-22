import { debounce, type DebouncedFunction } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { UIScene } from '../../scenes/Layers/UIScene.ts'
import { GameEvent } from '../events.ts'
import { EventsBinder } from '../Util/EventsBinder.ts'

export class Toaster extends SceneBound {
  private element: HTMLElement
  private queueFadeOut: DebouncedFunction<() => void>
  private binder: EventsBinder

  constructor(public scene: UIScene) {
    super(scene)

    this.element = document.getElementById('toaster-text')!

    this.queueFadeOut = debounce(() => {
      this.hide()
    }, 2000)

    this.binder = new EventsBinder()
    this.binder.add(scene.EVENTS, GameEvent.MESSAGE, this.message, this)
    this.binder.bind()
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
    this.binder.unBind()
    // @ts-expect-error: destroy
    this.binder = null
  }
}
