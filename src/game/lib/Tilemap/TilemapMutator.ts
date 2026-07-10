import { EMPTY, MatterType } from '../Matter/_Matter.types.ts'
import type { Tilemap } from './Tilemap.ts'

export class TilemapMutator {
  constructor(private tilemap: Tilemap) {
  }

  makeUTube(centerX: number, centerY: number, width: number, height: number, thickness: number, type: MatterType): void {
    let startX = centerX - width * 0.5
    let startY = centerY - height * 0.5
    this.tilemap.setRect(startX, startY, width, height, type)
    this.tilemap.setRect(centerX - (width - thickness * 2) * 0.5, startY, width - thickness * 2, height - thickness, EMPTY)
    this.tilemap.setRect(centerX - thickness * 0.5, startY, thickness, height - thickness * 2, type)
  }

  makeBowl(centerX: number, centerY: number, width: number, height: number, thickness: number, type: MatterType): void {
    let startX = centerX - width * 0.5
    let startY = centerY - height * 0.5
    this.tilemap.setRect(startX, startY, width, height, type)
    this.tilemap.setRect(centerX - (width - thickness * 2) * 0.5, startY, width - thickness * 2, height - thickness, EMPTY)
  }

  makeBox(centerX: number, centerY: number, width: number, height: number, thickness: number, type: MatterType): void {
    let startX = centerX - width * 0.5
    let startY = centerY - height * 0.5
    this.tilemap.setRect(startX, startY, width, height, type)
    this.tilemap.setRect(startX + thickness, startY + thickness, width - thickness * 2, height - thickness * 2, EMPTY)
  }

  fillRect(centerX: number, centerY: number, width: number, height: number, type: MatterType, fill = 0): void {
    let startX = centerX - width * 0.5
    let startY = centerY - height * 0.5
    this.tilemap.setRect(startX, startY, width, height, type, fill)
  }
}