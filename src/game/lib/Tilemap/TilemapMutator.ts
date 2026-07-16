import { FILL_MAX } from '../Matter/_Liquid.constants.ts'
import { EMPTY, MatterType, type MatterValue, PERMANENT } from '../Matter/_Matter.types.ts'
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

  makeBowl(centerX: number, centerY: number, width: number, height: number, thickness: number, borderType: MatterType, fillType?: MatterValue, fill = FILL_MAX): void {
    let startX = centerX - width * 0.5
    let startY = centerY - height * 0.5
    this.tilemap.setRect(startX, startY, width, height, borderType)
    const leftX = centerX - (width - thickness * 2) * 0.5
    this.tilemap.setRect(leftX, startY, width - thickness * 2, height - thickness, EMPTY)
    if (fillType) {
      this.tilemap.setRect(leftX, startY, width - thickness * 2, height - thickness * 2, fillType, fill)
    }
  }

  makePool(
    { x, y, width, height, thickness, fillType, fill = FILL_MAX, borderType = PERMANENT, origin = { x: 0, y: 0 } }:
    {
      x: number,
      y: number,
      width: number,
      height: number,
      thickness: number,
      fillType: MatterValue,
      borderType?: MatterValue,
      fill?: number,
      origin?: { x: number, y: number },
    }): void {
    let startX = x + width * origin.x
    let startY = y + height * origin.y
    this.tilemap.setRect(startX, startY, width, height, borderType)
    const innerWidth = width - thickness * 2
    const leftX = x + thickness + innerWidth * origin.x
    this.tilemap.setRect(leftX, startY, innerWidth, height - thickness, EMPTY)
    if (fillType) {
      this.tilemap.setRect(leftX, startY, innerWidth, height - thickness * 2, fillType, fill)
    }
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