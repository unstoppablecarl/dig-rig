import type { Weapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { formatKeys } from './input-mode-helpers.ts'

export class WeaponInputModeUI {
  private weapon: Weapon | null = null

  constructor(readonly element: HTMLElement) {}

  setWeapon(weapon: Weapon): void {
    this.weapon = weapon
    this.render()
  }

  notifyChanged(): void {
    this.render()
  }

  clear(): void {
    this.weapon = null
    this.set('')
  }

  render(): void {
    if (!this.weapon) {
      this.set('')
      return
    }
    const status = this.weapon.uiStatusControls?.()
    const sections = (status ?? '').split(' | ').filter(Boolean).map(
      s => `<span class="imu-section">${formatKeys(s)}</span>`
    ).join('')
    this.set(`
      <div class="imu">
        <div class="imu-header">
          <span class="imu-slot">${this.weapon.slot}</span>
          <span class="imu-label">Weapon</span>
          <strong>${this.weapon.displayName}</strong>
        </div>
        ${sections}
      </div>
    `)
  }

  private set(value: string) {
    if (this.element.innerHTML === value) return
    this.element.innerHTML = value
  }
}
