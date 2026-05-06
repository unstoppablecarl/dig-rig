import { Scene } from 'phaser'
import { type GUI, makeGUI } from '../../gui.ts'
import { MatterMeter } from '../../lib/UI/MatterMeter.ts'
import { PlayerUI } from '../../lib/UI/PlayerUI.ts'
import { makeFPSText } from '../../lib/UI/text.ts'
import { Toaster } from '../../lib/UI/Toaster.ts'
import type { GameLevel } from '../GameLevel.ts'

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
    this.initLevelDisplayName(gameScene.displayName)
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

  initLevelDisplayName(displayName: string) {
    const el = this.add.dom(120, 12)
      .setOrigin(0, 1)
      .createFromHTML('<div/>')
    el.node.id = 'current-level'
    el.node.innerHTML = displayName
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