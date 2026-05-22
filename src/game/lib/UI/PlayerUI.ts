import { type Scene } from 'phaser'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { GameEvent } from '../events.ts'
import type { Weapon } from '../Input/InputControllers/WeaponManagerInput.ts'
import { EventsBinder } from '../Util/EventsBinder.ts'

export class PlayerUI extends SceneBound {
  private currentWeapon: HTMLElement
  private binder: EventsBinder

  constructor(public scene: Scene, gameLevel: GameLevel) {
    super(scene)

    this.currentWeapon = document.getElementById('current-weapon-text') as HTMLElement

    this.binder = new EventsBinder()
    this.binder.add(scene.EVENTS, GameEvent.WEAPON_SELECTED, this.weaponSelected, this)
    this.binder.bind()

    this.weaponSelected(gameLevel.playerWeaponManager.activeWeapon())
  }

  weaponSelected(weapon: Weapon) {
    this.currentWeapon.innerHTML = `<strong>Weapon: </strong> [${weapon.slot}] ${weapon.displayName} ${weapon?.getSuffix?.() ?? ''}`
  }

  protected onDestroy() {
    this.binder.unBind()
    // @ts-expect-error: destroy
    this.binder = null
  }
}
