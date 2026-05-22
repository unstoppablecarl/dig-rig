import { Input } from 'phaser'
import { type FireMode } from '../../../config.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { GameEvent } from '../../events.ts'
import { BasicWeapon } from '../../Player/Weapons/BasicWeapon.ts'
import { BurstWeapon } from '../../Player/Weapons/BurstWeapon.ts'
import { InstantWeapon } from '../../Player/Weapons/InstantWeapon.ts'
import { RapidWeapon } from '../../Player/Weapons/RapidWeapon.ts'
import { TorchWeapon } from '../../Player/Weapons/TorchWeapon.ts'
import { TunnelWeapon } from '../../Player/Weapons/TunnelWeapon.ts'
import type { Projectile } from '../../Projectiles/Projectile.ts'
import { InputController } from './InputController.ts'
import ANY_KEY_DOWN = Input.Keyboard.Events.ANY_KEY_DOWN

export interface Weapon {
  setEnabled(value: boolean): void
  enabled: boolean
  readonly displayName: string
  readonly slot: number
  destroy(): void

  getSuffix?: () => string
}

export interface ImmediateWeapon extends Weapon {
  fire(mode: FireMode): void
}

export interface ChargeableWeapon extends Weapon {
  getQueuedProjectile(mode: FireMode): Projectile
  getChargePercent(): number
  fireQueued(): void
  getFireMode(): FireMode
}

export class WeaponManagerInput extends InputController {
  private readonly weapons = new Map<number, Weapon | ChargeableWeapon>()

  private _active: Weapon | ChargeableWeapon

  constructor(scene: GameLevel) {
    super(scene)
    this.bind(this.scene.input.keyboard!, ANY_KEY_DOWN, this.keydown)

    const weapons = [
      BasicWeapon,
      BurstWeapon,
      RapidWeapon,
      TorchWeapon,
      TunnelWeapon,
      InstantWeapon,
    ]

    for (const [index, Def] of weapons.entries()) {
      const slot = index + 1
      this.weapons.set(slot, new Def(scene, slot))
    }

    this._active = this.weapons.get(1) as Weapon
  }

  protected onEnable() {
    this._active.setEnabled(true)
  }

  protected onDisable() {
    this._active.setEnabled(false)
  }

  keydown(event: KeyboardEvent) {
    const key = parseInt(event.key, 10)
    if (Number.isNaN(key)) return

    if (this.weapons.has(key)) {
      this.setActive(key)
    }
  }

  private setActive(slot: number) {
    if (!this.enabled) return
    this._active.setEnabled(false)

    const weapon = this.weapons.get(slot) as Weapon
    weapon.setEnabled(true)
    this._active = weapon

    this.scene.EVENTS.emit(GameEvent.UI_WEAPON_UPDATE, weapon)
  }

  activeWeaponSlot(): number {
    return this._active.slot
  }

  activeWeapon(): Weapon | ChargeableWeapon {
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