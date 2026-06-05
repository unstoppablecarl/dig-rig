import { MatterType } from '../../Matter/_Matter-types.ts'
import { formatKeys } from './input-mode-helpers.ts'

export class BrushInputModeUI {
  private radius: number | null = null
  private matterType: MatterType | null = null

  constructor(readonly element: HTMLElement) {}

  setRadius(radius: number): void {
    this.radius = radius
    this.render()
  }

  setMatterType(type: MatterType): void {
    this.matterType = type
    this.render()
  }

  clear(): void {
    this.radius = null
    this.matterType = null
    this.element.innerHTML = ''
  }

  render(): void {
    if (this.radius === null || this.matterType === null) {
      this.element.innerHTML = ''
      return
    }
    const typeName = MatterType[this.matterType]
    this.element.innerHTML = `
      <div class="imu">
        <div class="imu-header">
          <span class="imu-label">Brush</span>
          <strong>${typeName}</strong>
        </div>
        ${[
          `Radius: ${this.radius} ${formatKeys('[Mouse Wheel] = resize')}`,
          formatKeys('[LMB] = paint'),
          formatKeys('[Shift+LMB] / [RMB] = erase'),
        ].map(s => `<span class="imu-section">${s}</span>`).join('')}
      </div>
    `
  }
}
