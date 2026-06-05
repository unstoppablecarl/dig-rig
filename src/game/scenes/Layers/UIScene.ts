import { Scene } from 'phaser'
import { type GUI, makeGUI } from '../../gui.ts'
import { MatterMeter } from '../../lib/UI/MatterMeter.ts'
import { Toaster } from '../../lib/UI/Toaster.ts'
import type { GameLevel } from '../GameLevel.ts'

export class UIScene extends Scene {
  static ID = 'UIScene'

  matterMeter: MatterMeter
  gui: GUI
  toast: Toaster

  constructor() {
    super(UIScene.ID)
  }

  init({ gameScene }: { gameScene: GameLevel }) {
    this.gui = makeGUI(gameScene)
  }

  create({ gameScene }: { gameScene: GameLevel }) {
    console.log('ui.create')
    this.matterMeter = new MatterMeter(this, gameScene)
    this.toast = new Toaster(this)
    this.gui.setScene(gameScene)
  }

  update(_time: number, _delta: number) {
    this.matterMeter.update()
  }

  destroy() {
    // @ts-expect-error: destroy
    this.toast = null
    // @ts-expect-error: destroy
    this.matterMeter = null
  }
}
