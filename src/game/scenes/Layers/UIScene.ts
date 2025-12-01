import { Scene } from 'phaser'
import type { GameLevel } from '../GameLevel.ts'
import { MatterMeter } from '../../lib/UI/MatterMeter.ts'
import { makeFPSText } from '../../lib/UI/text.ts'
import { type GUI, makeGUI } from '../../gui.ts'
import { PlayerUI } from '../../lib/UI/PlayerUI.ts'
import { Toaster } from '../../lib/UI/Toaster.ts'

export class UIScene extends Scene {
  static ID = 'UIScene'

  public matterMeter: MatterMeter
  public fpsText: () => void
  public gui: GUI
  public toast: Toaster

  constructor() {
    super(UIScene.ID)
  }

  init({ gameScene }: { gameScene: GameLevel }) {
    this.gui = makeGUI(gameScene)
  }

  create({ gameScene }: { gameScene: GameLevel }) {
    this.matterMeter = new MatterMeter(this, gameScene)
    this.toast = new Toaster(this, gameScene)
    this.gui.setScene(gameScene)
    this.fpsText = makeFPSText(this)

    new PlayerUI(this, gameScene)
  }

  update(_time: number, _delta: number) {
    this.matterMeter.update()
    this.fpsText()
  }

  destroy() {

    // @ts-expect-error: destroy
    this.toast = null
    // @ts-expect-error: destroy
    this.matterMeter = null
    // @ts-expect-error: destroy
    this.gameScene = null
  }
}