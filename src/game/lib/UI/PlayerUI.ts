import { GameObjects, Scale, type Scene } from 'phaser'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { EVENT_WEAPON_SELECTED } from '../events.ts'
import type { Weapon } from '../Player/Weapons/PlayerWeaponManager.ts'
import RESIZE = Scale.Events.RESIZE

export class PlayerUI extends SceneBound {
  private currentWeapon: GameObjects.DOMElement

  constructor(public scene: Scene, gameLevel: GameLevel) {
    super(scene)

    scene.scale.on(RESIZE, this.resize, this)

    this.currentWeapon = scene.add.dom(0, 0)
      .setOrigin(0, 1)
      .createFromHTML('<div/>')
    this.currentWeapon.node.id = 'current-weapon-text'

    this.scene.EVENTS.on(EVENT_WEAPON_SELECTED, this.weaponSelected, this)
    this.weaponSelected(gameLevel.playerWeaponManager.activeWeapon())

    this.resize()
  }

  resize() {
    if (!this.scene) return // destroyed
    const canvasHeight = this.scene.game.canvas.height

    this.currentWeapon
      .setPosition(0, canvasHeight)
  }

  weaponSelected(weapon: Weapon) {
    this.currentWeapon.setHTML(`<strong>Weapon: </strong> [${weapon.slot}] ${weapon.displayName}`)
  }
}