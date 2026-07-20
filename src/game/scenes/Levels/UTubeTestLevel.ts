import type { PartialMatterRenderConfig } from '../../config/colors.ts'
import { PortableMatterTank } from '../../lib/Entities/defs/PortableMatterTank.ts'
import {
  ACID,
  LAVA,
  MatterType,
  NAPALM,
  OIL,
  PERMANENT,
  SALT_WATER,
  SOLID,
  WATER,
} from '../../lib/Matter/_Matter.types.ts'
import { canHaveOwner } from '../../lib/Matter/matter.ts'
import { PLAYER_MATTER_TANK_ID } from '../../lib/Matter/Tank/_MatterTank.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { TilemapBuilder } from '../../lib/Tilemap/TilemapBuilder.ts'
import type { TilemapRendererConfig } from '../../lib/Tilemap/TilemapRendererConfig'
import { GameLevel } from '../GameLevel.ts'
import terrain from './TestLevel2/TestLevel2.png'
import CanvasTexture = Phaser.Textures.CanvasTexture

export default class UTubeTestLevel extends GameLevel {
  registerEntities() {
    return [
      PortableMatterTank,
    ]
  }

  private TERRAIN: string

  preload() {
    this.TERRAIN = this.loadPrefixedPixelImage('terrain', terrain)
    super.preload()

    this.preloadPlayer()
  }

  protected tilemapRendererConfig(): Partial<TilemapRendererConfig> {
    return {
      glowStrength: 0.99,
      glowRadius: 12,
    }
  }

  protected makeMatterRenderConfig(): PartialMatterRenderConfig {
    const outlineOpacity = 0.4
    return {
      [SOLID]: {
        outlineOpacity,
      },
      [PERMANENT]: {
        outlineOpacity,
      },
    }
  }

  getTerrainTexture() {
    return this.textures.get(this.TERRAIN) as CanvasTexture
  }

  makeTileMap() {
    const builder = TilemapBuilder.make(
      this,
      2000,
      1000,
    )

    const ref = 600
    builder.setRect(0, ref - 100, builder.width, 500, SOLID)

    this.makeTestPools(builder, ref)

    builder.setBorder(2, PERMANENT)

    return builder
  }

  makeTestPools(builder: TilemapBuilder, ref: number) {

    const types: MatterType[] = [
      ACID,
      LAVA,
      NAPALM,
      WATER,
      SALT_WATER,
      OIL,
    ]

    let x = 200
    const y = ref - 210
    const width = 120
    const height = 60
    const thickness = 10

    const liqWidthGap = 12
    const liqWidth = ((width - thickness * 3) * 0.5) - liqWidthGap * 2
    const liqHeight = 100
    const liqY = ref - 300

    for (const type of types) {

      const liqX = x + thickness + liqWidthGap

      builder.makeUTube(
        x,
        y,
        width,
        height,
        thickness,
        PERMANENT,
      )
      if (canHaveOwner(type)) {
        builder.setRect(liqX, liqY, liqWidth, liqHeight, type, PLAYER_MATTER_TANK_ID)
      } else {
        builder.setRect(liqX, liqY, liqWidth, liqHeight, type)
      }
      x += 100
    }
  }

  makePlayer() {
    const player = new Player(this, 100, 400)
    const tank = this.entityFactory.spawn(PortableMatterTank, 10, 350, 99)

    player.matterTank.overflowTank = tank.matterTank
    return player
  }
}
