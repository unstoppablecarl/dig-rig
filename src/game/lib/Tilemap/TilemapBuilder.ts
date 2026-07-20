import { type Color32, type PixelData, unpackAlpha } from 'pixel-data-js'
import type { MatterTankManagerData } from '../MatterEngine/data/MatterTankManagerData.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { FILL_MAX } from '../Matter/_Liquid.constants.ts'
import { EMPTY, MatterType, PERMANENT, setOwner, setSettled, SOLID } from '../Matter/_Matter.types.ts'
import { getReserveDestroyAmount, type HasOwnerIdTypes, isLiquid, type NonOwnerIdTypes } from '../Matter/matter.ts'
import { type MatterTankId, NO_MATTER_TANK_ID } from '../Matter/Tank/_MatterTank.types.ts'
import { Tilemap } from './Tilemap.ts'

export class TilemapBuilder {
  readonly width: number
  readonly height: number
  readonly tiles: Uint32Array

  // Accumulated as owned matter is placed (see setTileRaw) — a tile whose
  // type reserves destroy-charge (acid, lava, ...) always starts full, same
  // assumption Brush.reserveDestroyCharge makes for player-painted matter at
  // runtime, so this stays exact without needing to inspect the actual fill
  // written per tile.
  private readonly reservedDestroyFillUnits = new Map<MatterTankId, number>()

  static make(scene: GameLevel, width: number, height: number) {
    return new TilemapBuilder(new Tilemap(scene, width, height))
  }

  constructor(readonly tilemap: Tilemap) {
    this.width = tilemap.width
    this.height = tilemap.height
    this.tiles = tilemap.tiles
  }

  getTilemap(): Tilemap {
    return this.tilemap
  }

  // Levels that place owned acid/lava/etc. via setTile/setRect/setRectOrigin
  // can't reserve destroy-charge for it at construction time — the tank (and
  // the worker holding SimMatterTanks) don't exist yet (see GameLevel's
  // preCreateLevel ordering). Call this once they do, instead of every level
  // re-deriving reserveAmount * FILL_MAX * tileCount by hand.
  applyReservedDestroyCharges(matterTankManager: MatterTankManagerData): void {
    for (const [ownerId, fillUnits] of this.reservedDestroyFillUnits) {
      matterTankManager.addReservedDestroyPlacedFillUnits(ownerId, fillUnits)
    }
  }

  makeUTubeCentered(centerX: number, centerY: number, width: number, height: number, thickness: number, type: NonOwnerIdTypes): void {
    let startX = centerX - width * 0.5
    let startY = centerY - height * 0.5
    this.setRectRaw(startX, startY, width, height, type)
    this.setRectRaw(centerX - (width - thickness * 2) * 0.5, startY, width - thickness * 2, height - thickness, EMPTY)
    this.setRectRaw(centerX - thickness * 0.5, startY, thickness, height - thickness * 2, type)
  }

  makeUTube(x: number, y: number, width: number, height: number, thickness: number, type: NonOwnerIdTypes): void {
    let startX = x
    let startY = y
    this.setRectRaw(startX, startY, width, height, type)
    this.setRectRaw(x + thickness, startY, width - thickness * 2, height - thickness, EMPTY)
    this.setRectRaw(x + width * 0.5 - thickness* 0.5, startY, thickness, height - thickness * 2, type)
  }

  makeBowl(centerX: number, centerY: number, width: number, height: number, thickness: number, borderType: NonOwnerIdTypes, fillType?: NonOwnerIdTypes, fill = FILL_MAX): void {
    let startX = centerX - width * 0.5
    let startY = centerY - height * 0.5
    this.setRectRaw(startX, startY, width, height, borderType)
    const leftX = centerX - (width - thickness * 2) * 0.5
    this.setRectRaw(leftX, startY, width - thickness * 2, height - thickness, EMPTY)
    if (fillType) {
      this.setRectRaw(leftX, startY, width - thickness * 2, height - thickness * 2, fillType, undefined, fill)
    }
  }

  makePool(
    args: {
      x: number,
      y: number,
      width: number,
      height: number,
      thickness: number,
      value: NonOwnerIdTypes,
      ownerId?: undefined,
      borderType?: MatterType,
      fill?: number,
      origin?: { x: number, y: number },
    }): void
  makePool(
    args: {
      x: number,
      y: number,
      width: number,
      height: number,
      thickness: number,
      value: HasOwnerIdTypes,
      ownerId: MatterTankId,
      borderType?: MatterType,
      fill?: number,
      origin?: { x: number, y: number },
    }): void
  makePool(
    { x, y, width, height, thickness, value, fill = FILL_MAX, ownerId, borderType = PERMANENT, origin = { x: 0, y: 0 } }:
    {
      x: number,
      y: number,
      width: number,
      height: number,
      thickness: number,
      value: MatterType,
      borderType?: MatterType,
      ownerId?: MatterTankId,
      fill?: number,
      origin?: { x: number, y: number },
    }): void {
    let startX = x + width * origin.x
    let startY = y + height * origin.y
    this.setRectRaw(startX, startY, width, height, borderType)
    const innerWidth = width - thickness * 2
    const leftX = x + thickness + innerWidth * origin.x
    this.setRectRaw(leftX, startY, innerWidth, height - thickness, EMPTY)
    if (value) {
      this.setRectRaw(leftX, startY, innerWidth, height - thickness * 2, value, ownerId, fill)
    }
  }

  setRectOrigin(
    args: {
      x: number,
      y: number,
      width: number,
      height: number,
      value: NonOwnerIdTypes,
      ownerId?: undefined,
      fill?: number,
      settled?: boolean,
      origin?: { x: number, y: number },
    }): void
  setRectOrigin(
    args: {
      x: number,
      y: number,
      width: number,
      height: number,
      value: HasOwnerIdTypes,
      ownerId: MatterTankId,
      fill?: number,
      settled?: boolean,
      origin?: { x: number, y: number },
    }): void
  setRectOrigin(
    { x, y, width, height, value, fill = undefined, ownerId, settled, origin = { x: 0, y: 0 } }:
    {
      x: number,
      y: number,
      width: number,
      height: number,
      value: MatterType,
      fill?: number,
      ownerId?: MatterTankId,
      settled?: boolean,
      origin?: { x: number, y: number },
    }): void {
    const startX = Math.floor(x - width * origin.x)
    const startY = Math.floor(y - height * origin.y)

    this.setRectRaw(startX, startY, width, height, value, ownerId, fill, settled)
  }

  setRect(
    x: number,
    y: number,
    width: number,
    height: number,
    value: NonOwnerIdTypes,
    ownerId?: undefined,
    fill?: number,
    settled?: boolean,
  ): void
  setRect(
    x: number,
    y: number,
    width: number,
    height: number,
    value: HasOwnerIdTypes,
    ownerId: MatterTankId,
    fill?: number,
    settled?: boolean,
  ): void
  setRect(
    x: number,
    y: number,
    width: number,
    height: number,
    value: MatterType,
    ownerId?: MatterTankId,
    fill?: number,
    settled?: boolean,
  ): void {
    this.setRectRaw(x, y, width, height, value, ownerId, fill, settled)
  }

  private setRectRaw(
    x: number,
    y: number,
    width: number,
    height: number,
    value: MatterType,
    ownerId?: MatterTankId,
    fill?: number,
    settled?: boolean,
  ): void {
    const x0 = Math.max(0, x)
    const y0 = Math.max(0, y)
    const x1 = Math.min(x + width, this.width)
    const y1 = Math.min(y + height, this.height)

    if (x1 <= x0 || y1 <= y0) {
      throw new Error('rect coordinates are outside the grid boundaries.')
    }

    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        this.setTileRaw(xx, yy, value, ownerId, fill, settled)
      }
    }
  }

  setTile(x: number, y: number, value: NonOwnerIdTypes, ownerId?: undefined, fill?: number, settled?: boolean): boolean
  setTile(x: number, y: number, value: HasOwnerIdTypes, ownerId: MatterTankId, fill?: number, settled?: boolean): boolean
  setTile(x: number, y: number, value: MatterType, ownerId?: MatterTankId, fill?: number, settled?: boolean): boolean {
    return this.setTileRaw(x, y, value, ownerId, fill, settled)
  }

  private setTileRaw(x: number, y: number, value: MatterType, ownerId?: MatterTankId, fill?: number, settled?: boolean): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false
    const idx = y * this.width + x
    let raw: number = value
    if (ownerId !== undefined) raw = setOwner(raw, ownerId)
    if (settled !== undefined) raw = setSettled(raw, settled)
    if (ownerId !== undefined && ownerId !== NO_MATTER_TANK_ID) {
      const reserveAmount = getReserveDestroyAmount(value)
      if (reserveAmount > 0) {
        const prev = this.reservedDestroyFillUnits.get(ownerId) ?? 0
        this.reservedDestroyFillUnits.set(ownerId, prev + reserveAmount * FILL_MAX)
      }
    }
    this.tiles[idx] = raw
    if (isLiquid(value) && fill === undefined) {
      fill = FILL_MAX
    }
    if (fill !== undefined) {
      this.tilemap.fillLevels[idx] = fill
    }
    return true
  }

  setBorder(thickness: number, value: NonOwnerIdTypes) {
    const { width, height } = this
    for (let t = 0; t < thickness; t++) {
      for (let x = t; x < width - t; x++) {
        this.setTileRaw(x, t, value)
        this.setTileRaw(x, height - 1 - t, value)
      }
      for (let y = t + 1; y < height - 1 - t; y++) {
        this.setTileRaw(t, y, value)
        this.setTileRaw(width - 1 - t, y, value)
      }
    }
  }

  setFromPixelDataAlpha(pixelData: PixelData, value: NonOwnerIdTypes): void {
    if (this.width !== pixelData.w || this.height !== pixelData.h) {
      throw new Error('pixelData must match w/h of tilemap')
    }
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x
        if (unpackAlpha(pixelData.data[idx] as Color32) > 0) {
          this.setTileRaw(x, y, value)
        }
      }
    }
  }

  static makeFromSolidAndPermanentPixelData(
    scene: GameLevel,
    solidData: PixelData,
    permanentData: PixelData,
  ): TilemapBuilder {
    if (solidData.w !== permanentData.w || solidData.h !== permanentData.h) {
      throw new Error('solidData and permanentData must be the same dimensions')
    }
    const { w, h } = solidData
    const builder = TilemapBuilder.make(scene, w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (unpackAlpha(permanentData.data[idx] as Color32) > 0) {
          builder.setTile(x, y, PERMANENT)
        } else if (unpackAlpha(solidData.data[idx] as Color32) > 0) {
          builder.setTile(x, y, SOLID)
        }
      }
    }

    return builder
  }
}
