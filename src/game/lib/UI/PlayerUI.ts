import { type Scene } from 'phaser'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { GameEvent } from '../events.ts'
import type { Weapon } from '../Player/Weapons/PlayerWeaponManager.ts'

export class PlayerUI extends SceneBound {
  private currentWeapon: HTMLElement

  constructor(public scene: Scene, gameLevel: GameLevel) {
    super(scene)

    this.currentWeapon = document.getElementById('current-weapon-text') as HTMLElement

    this.scene.EVENTS.on(GameEvent.WEAPON_SELECTED, this.weaponSelected, this)
    this.weaponSelected(gameLevel.playerWeaponManager.activeWeapon())
  }

  weaponSelected(weapon: Weapon) {
    this.currentWeapon.innerHTML = `<strong>Weapon: </strong> [${weapon.slot}] ${weapon.displayName} ${weapon?.getSuffix?.() ?? ''}`
  }

  protected onDestroy() {
    this.scene.EVENTS.off(GameEvent.WEAPON_SELECTED, this.weaponSelected, this)
  }
}
