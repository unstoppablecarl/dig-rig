import { Input } from 'phaser'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { GAME_LEVEL_LOADED } from '../../events.ts'
import { FireGroup } from '../../Player/_FireMode-types'
import { SLOT_TO_WEAPON, WEAPONS, type WeaponSlot } from '../../Player/weapons.ts'
import { InputController } from './InputController.ts'
import ANY_KEY_DOWN = Input.Keyboard.Events.ANY_KEY_DOWN

export interface Weapon {
  setEnabled(value: boolean): void
  enabled: boolean
  destroy(): void
  onMouseWheel?(deltaY: number): boolean
  uiStatusControls?(): string
  getCharge(): number
}

export interface FireGroupWeapon extends Weapon {
  getFireGroup(): FireGroup
}

export class WeaponManagerInput extends InputController {
  private readonly weapons = new Map<WeaponSlot, Weapon | FireGroupWeapon>()

  private _active: Weapon | FireGroupWeapon

  constructor(scene: GameLevel) {
    super(scene)

    this.addEvent(this.scene.input.keyboard!, ANY_KEY_DOWN, this.keydown)

    for (const item of Object.values(WEAPONS)) {
      this.weapons.set(item.slot, new item.constructor(scene))
    }

    this._active = this.weapons.get(1) as Weapon

    this.addEvent(this.scene.game.events, GAME_LEVEL_LOADED, () => {
      this.setActive(this.scene.weaponUIState.slot)
      if (!this._active) {
        debugger
      }
    })
  }

  protected onEnable() {
    this._active.setEnabled(true)
  }

  protected onDisable() {
    this._active.setEnabled(false)
  }

  onMouseWheel(deltaY: number): boolean {
    return this._active.onMouseWheel?.(deltaY) ?? false
  }

  keydown(event: KeyboardEvent) {
    const key = parseInt(event.key, 10) as WeaponSlot
    if (Number.isNaN(key)) return

    if (this.weapons.has(key)) {
      this.setActive(key)
    }
  }

  private setActive(slot: WeaponSlot) {
    if (!this.enabled) return
    this._active.setEnabled(false)

    const weapon = this.weapons.get(slot)!
    weapon.setEnabled(true)
    this._active = weapon
    this.scene.weaponUIState.id = SLOT_TO_WEAPON[slot].id
  }

  activeWeapon(): Weapon | FireGroupWeapon {
    return this._active
  }

  protected onDestroy() {
    super.onDestroy()
    for (const weapon of this.weapons.values()) {
      weapon.destroy()
    }
    // @ts-expect-error: destroy
    this._active = null
  }
}