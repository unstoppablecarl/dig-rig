import { Input } from 'phaser'
import { type FireMode } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { GameEvent } from '../../events.ts'
import type { InputController } from '../../Input/InputManager.ts'
import type { Projectile } from '../../Projectiles/Projectile.ts'
import { BasicWeapon } from './BasicWeapon.ts'
import { BurstWeapon } from './BurstWeapon.ts'
import { InstantWeaponCreate } from './InstantWeaponCreate.ts'
import { InstantWeaponDestroy } from './InstantWeaponDestroy.ts'
import { RapidWeapon } from './RapidWeapon.ts'
import { TorchWeapon } from './TorchWeapon.ts'
import { TunnelWeapon } from './TunnelWeapon.ts'
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

export interface ContinuousWeapon extends Weapon {
  firing(value: boolean, mode: FireMode): void,
}

export class PlayerWeaponManager extends SceneBound<GameLevel> implements InputController {
  private readonly weapons = new Map<number, Weapon | ChargeableWeapon>()

  private _enabled = false
  private _active: Weapon | ChargeableWeapon

  constructor(scene: GameLevel) {
    super(scene)

    const weapons = [
      BasicWeapon,
      BurstWeapon,
      RapidWeapon,
      TorchWeapon,
      TunnelWeapon,
      InstantWeaponCreate,
      InstantWeaponDestroy,
    ]

    for (const [index, Def] of weapons.entries()) {
      const slot = index + 1
      this.weapons.set(slot, new Def(scene, slot))
    }

    this.setActive(1)
  }

  get enabled() {
    return this._enabled
  }

  setInputEnabled(value: boolean): void {
    if (this._enabled === value) return

    this._enabled = value
    this._active.setEnabled(value)

    if (value) {
      this.scene.input.keyboard!.on(ANY_KEY_DOWN, this.keydown, this)
    } else {
      this.scene.input.keyboard!.off(ANY_KEY_DOWN, this.keydown, this)
    }
  }

  keydown(event: KeyboardEvent) {
    const key = parseInt(event.key, 10)
    if (Number.isNaN(key)) return

    if (this.weapons.has(key)) {
      this.setActive(key)
    }
  }

  private setActive(slot: number) {
    if (this._active) {
      this._active.setEnabled(false)
    }

    const weapon = this.weapons.get(slot) as Weapon

    weapon.setEnabled(true)

    this.scene.EVENTS.emit(GameEvent.WEAPON_SELECTED, weapon)

    this._active = weapon
  }

  activeWeaponSlot(): number {
    return this._active.slot
  }

  activeWeapon(): Weapon | ChargeableWeapon {
    return this._active
  }

  protected onDestroy() {
    this.setInputEnabled(false)
    for (const weapon of this.weapons.values()) {
      weapon.destroy()
    }
  }
}