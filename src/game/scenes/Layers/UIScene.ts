import { Scene } from 'phaser'
import { type GUI, makeGUI } from '../../gui.ts'
import { BrushInputModeUI } from '../../lib/UI/InputModes/BrushInputModeUI.ts'
import { MatterMeter } from '../../lib/UI/MatterMeter.ts'
import { WeaponInputModeUI } from '../../lib/UI/InputModes/WeaponInputModeUI.ts'
import { makeFPSText } from '../../lib/UI/text.ts'
import { Toaster } from '../../lib/UI/Toaster.ts'
import type { GameLevel } from '../GameLevel.ts'

export class UIScene extends Scene {
  static ID = 'UIScene'

  public matterMeter: MatterMeter
  public fpsText: (now?: number) => void
  public gui: GUI
  public toast: Toaster
  weapon: WeaponInputModeUI
  brush: BrushInputModeUI

  constructor() {
    super(UIScene.ID)
  }

  init({ gameScene }: { gameScene: GameLevel }) {
    this.gui = makeGUI(gameScene)
    this.initLevelDisplayName(gameScene.displayName)
  }

  create({ gameScene }: { gameScene: GameLevel }) {
    this.matterMeter = new MatterMeter(this, gameScene)
    this.toast = new Toaster(this)
    this.gui.setScene(gameScene)
    this.fpsText = makeFPSText(this)
    const inputModeEl = document.getElementById('current-input-mode-text')!
    this.weapon = new WeaponInputModeUI(inputModeEl)
    this.brush = new BrushInputModeUI(inputModeEl)
    this.weapon.setWeapon(gameScene.playerWeaponManager.activeWeapon())
  }

  update(time: number, _delta: number) {
    this.matterMeter.update()
    this.fpsText(time)
  }

  initLevelDisplayName(displayName: string) {
    const el = document.getElementById('current-level-text')!
    el.innerHTML = displayName
  }

  destroy() {
    // @ts-expect-error: destroy
    this.toast = null
    // @ts-expect-error: destroy
    this.matterMeter = null
  }
}