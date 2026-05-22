import { GameObjects, type Scene, Tweens } from 'phaser'
import { CREATE_COLOR, DESTROY_COLOR, FireMode } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { ChargeableWeapon, Weapon } from '../Input/InputControllers/WeaponManagerInput.ts'
import DOMElement = GameObjects.DOMElement
import Rectangle = GameObjects.Rectangle
import Tween = Tweens.Tween

// Fraction of tank per second (1.0 = full range in 1 s).
const TWEEN_RATE = 0.3
const TWEEN_START_DELAY = 50
const SHOW_TWEEN = true

export class MatterMeter extends SceneBound {
  private matter: Rectangle
  private destroyPending: Rectangle
  private createPending: Rectangle

  private prevMatter: number
  private charge: Rectangle
  private text: DOMElement
  private tween: Tween | null = null

  constructor(
    public scene: Scene,
    public gameLevel: GameLevel,
  ) {
    super(scene)

    const matterTank = gameLevel.player.matterTank
    this.prevMatter = matterTank.matterStart

    const BORDER_COLOR = 0xffffff
    const METER_COLOR = 0xffffff
    const PENDING_ALPHA = 0.5
    const TEXT_BG_HEIGHT = 30
    const margin = 2

    const borderR = {
      x: 40,
      y: 60,
      w: 40,
      h: 300,
    }
    const fillR = {
      x: borderR.x,
      y: borderR.y - margin + borderR.h,
      w: borderR.w - margin * 2 - 1,
      h: borderR.h - margin * 2 - 1,
    }
    const chargeR = { x: borderR.x, y: fillR.y, w: 20, h: fillR.h }

    const border = scene.add.rectangle(borderR.x + 0.5, borderR.y + 0.5, borderR.w, borderR.h)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, BORDER_COLOR)

    this.matter = scene.add.rectangle(fillR.x + 0.5, fillR.y, fillR.w, fillR.h)
      .setOrigin(0.5, 1)
      .setFillStyle(METER_COLOR)
      .setScale(1, matterTank.matterStart / matterTank.matterMax)

    this.charge = scene.add.rectangle(chargeR.x + 1, chargeR.y, chargeR.w, chargeR.h)
      .setOrigin(0.5, 1)
      .setFillStyle(0xffffff, 1)

    this.destroyPending = scene.add.rectangle(chargeR.x+1, chargeR.y, 30, chargeR.h)
      .setOrigin(0.5, 1)
      .setFillStyle(DESTROY_COLOR, PENDING_ALPHA)

    this.createPending = scene.add.rectangle(chargeR.x+1, chargeR.y, 30, chargeR.h)
      .setOrigin(0.5, 0)
      .setFillStyle(CREATE_COLOR, PENDING_ALPHA)

    this.text = scene.add.dom(border.x, border.getBounds().bottom + TEXT_BG_HEIGHT * 0.5)
      .setW(this.matter.width)
      .createFromHTML('<div/>')
    this.text.node.id = 'matter-meter-text'

    const textBG = scene.add.rectangle(borderR.x+0.5, borderR.y + borderR.h + 1, borderR.w+ 1, TEXT_BG_HEIGHT + 1)
      .setOrigin(0.5, 0)
      .setFillStyle(BORDER_COLOR, 1)

    const container = scene.add.container()
    container.add([
      border,
      this.destroyPending,
      this.matter,
      this.createPending,
      this.charge,
      textBG,
    ])
  }

  update() {
    const matterTank = this.gameLevel.player.matterTank

    let diffY: number
    if (SHOW_TWEEN) {
      const matterChanged = this.prevMatter !== matterTank.matterContained()
      if (matterChanged) {
        if (this.tween) this.tween.stop()

        const displayedPercent = this.matter.scaleY
        const distance = Math.abs(displayedPercent - matterTank.percent())
        const duration = (distance / TWEEN_RATE) * 1000

        this.tween = this.scene.tweens.add({
          targets: this.matter,
          scaleY: matterTank.percent(),
          duration,
          delay: TWEEN_START_DELAY,
          ease: 'Linear',
          onComplete: () => {
            this.tween = null
          },
        })
      }
      diffY = this.matter.scaleY - matterTank.percent()
    } else {
      this.matter.scaleY = matterTank.percent()
      diffY = 0
    }

    let matterText = Math.floor(matterTank.matterContained()).toString()
    if (matterText === '0') {
      matterText = ''
    }
    this.text.setText(matterText)

    const matterTopY = this.matter.getBounds().y

    this.destroyPending.y = matterTopY
    this.destroyPending.scaleY = Math.max(matterTank.getPendingChargePercent(FireMode.DESTROY) - diffY, 0)

    this.createPending.y = matterTopY
    this.createPending.scaleY = Math.max(matterTank.getPendingChargePercent(FireMode.CREATE) + diffY, 0)

    const weapon = this.gameLevel.playerWeaponManager.activeWeapon() as Weapon | ChargeableWeapon
    if ('getChargePercent' in weapon) {
      const chargePercent = weapon.getChargePercent()
      const mode = weapon.getFireMode()

      if (mode === FireMode.DESTROY) {
        this.charge.setOrigin(0.5, 1)
        this.charge.y = this.destroyPending.getBounds().y
        this.charge.scaleY = chargePercent * matterTank.getChargeAvailablePercent(FireMode.DESTROY)
        this.charge.fillColor = DESTROY_COLOR
      } else if (mode === FireMode.CREATE) {
        this.charge.setOrigin(0.5, 0)
        this.charge.y = this.createPending.getBounds().bottom
        this.charge.scaleY = chargePercent * matterTank.getChargeAvailablePercent(FireMode.CREATE)
        this.charge.fillColor = CREATE_COLOR
      }
    }

    this.prevMatter = matterTank.matterContained()
  }

  protected onDestroy() {
    this.tween?.stop()
    // @ts-expect-error: destroy
    this.gameLevel = null
  }
}
