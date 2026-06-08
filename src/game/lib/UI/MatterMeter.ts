import { GameObjects, type Scene, Tweens } from 'phaser'
import { watch, type WatchHandle } from 'vue'
import { CREATE_COLOR, DESTROY_COLOR } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { FireGroupWeapon, Weapon } from '../Input/InputController/WeaponManagerInput.ts'
import type { MatterTank } from '../Matter/MatterTank/MatterTank.ts'
import { FireGroup, FireMode } from '../Player/_FireMode-types'
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
  private prevMatterText = ''
  private destroyCharge: Rectangle
  private createCharge: Rectangle
  private text: DOMElement
  private tween: Tween | null = null

  private matterTank: MatterTank
  private unwatchTank: WatchHandle

  constructor(
    public scene: Scene,
    public gameLevel: GameLevel,
  ) {
    super(scene)

    this.unwatchTank = watch(
      () => gameLevel.weaponUIState.activeMatterTank,
      (tank) => {
        if (tank) this.setMatterTank(tank as MatterTank)
      },
      { immediate: true },
    )

    const BORDER_COLOR = 0xffffff
    const METER_COLOR = 0xffffff
    const PENDING_ALPHA = 0.5
    const CHARGE_ALPHA = 0.75
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
      .setDepth(0)

    this.destroyCharge = scene.add.rectangle(chargeR.x + 1, chargeR.y, chargeR.w, chargeR.h)
      .setOrigin(0.5, 1)
      .setFillStyle(DESTROY_COLOR, CHARGE_ALPHA)
      .setDepth(100)

    this.createCharge = scene.add.rectangle(chargeR.x + 1, chargeR.y, chargeR.w, chargeR.h)
      .setOrigin(0.5, 0)
      .setFillStyle(CREATE_COLOR, CHARGE_ALPHA)
      .setDepth(100)

    this.destroyPending = scene.add.rectangle(chargeR.x + 1, chargeR.y, 30, chargeR.h)
      .setOrigin(0.5, 1)
      .setFillStyle(DESTROY_COLOR, PENDING_ALPHA)
      .setDepth(100)

    this.createPending = scene.add.rectangle(chargeR.x + 1, chargeR.y, 30, chargeR.h)
      .setOrigin(0.5, 0)
      .setFillStyle(CREATE_COLOR, PENDING_ALPHA)
      .setDepth(100)

    this.text = scene.add.dom(border.x, border.getBounds().bottom + TEXT_BG_HEIGHT * 0.5)
      .setW(this.matter.width)
      .createFromHTML('<div/>')
    this.text.node.id = 'matter-meter-text'

    const textBG = scene.add.rectangle(borderR.x + 0.5, borderR.y + borderR.h + 1, borderR.w + 1, TEXT_BG_HEIGHT + 1)
      .setOrigin(0.5, 0)
      .setFillStyle(BORDER_COLOR, 1)

    const container = scene.add.container()
    container.add([
      border,
      this.destroyPending,
      this.matter,
      this.createPending,
      this.destroyCharge,
      textBG,
    ])
  }

  update() {
    const matterTank = this.matterTank
    if (!matterTank) return

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
    if (matterText === '0') matterText = ''
    if (matterText !== this.prevMatterText) {
      this.prevMatterText = matterText
      this.text.setText(matterText)
    }

    const matterTopY = this.matter.getBounds().y

    this.destroyPending.y = matterTopY
    this.destroyPending.scaleY = Math.max(matterTank.getPendingChargePercent(FireMode.DESTROY) - diffY, 0)

    this.createPending.y = matterTopY
    this.createPending.scaleY = Math.max(matterTank.getPendingChargePercent(FireMode.CREATE) + diffY, 0)

    const weapon = this.gameLevel.playerWeaponManager.activeWeapon() as Weapon | FireGroupWeapon
    if ('getFireGroup' in weapon) {
      const group = weapon.getFireGroup()

      if (group === FireGroup.CREATE_DESTROY) {
        this.destroyCharge.y = this.destroyPending.getBounds().y
        const destroyPercent = Math.min(1, weapon.getCharge() / this.matterTank.chargeAvailable(FireMode.DESTROY))
        this.destroyCharge.scaleY = destroyPercent * matterTank.getChargeAvailablePercent(FireMode.DESTROY)

        this.createCharge.y = this.createPending.getBounds().bottom
        const createPercent = Math.min(1, weapon.getCharge() / this.matterTank.chargeAvailable(FireMode.CREATE))
        this.createCharge.scaleY = createPercent * matterTank.getChargeAvailablePercent(FireMode.CREATE)
      } else {
        this.destroyCharge.scaleY = 0
        this.createCharge.scaleY = 0
      }
    } else {
      this.destroyCharge.scaleY = 0
      this.createCharge.scaleY = 0
    }

    this.prevMatter = matterTank.matterContained()
  }

  setMatterTank(matterTank: MatterTank): void {
    this.matterTank = matterTank
  }

  protected onDestroy() {
    this.unwatchTank()
    this.tween?.stop()
    // @ts-expect-error: destroy
    this.gameLevel = null
  }
}
