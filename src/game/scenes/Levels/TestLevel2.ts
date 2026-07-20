import type { PartialMatterRenderConfig } from '../../config/colors.ts'
import { Crate } from '../../lib/Entities/defs/Crate.ts'
import { PortableMatterTank } from '../../lib/Entities/defs/PortableMatterTank.ts'
import { ACID, EMPTY, PERMANENT, SOLID, WATER } from '../../lib/Matter/_Matter.types.ts'
import { PLAYER_MATTER_TANK_ID } from '../../lib/Matter/Tank/_MatterTank.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { TilemapBuilder } from '../../lib/Tilemap/TilemapBuilder.ts'
import type { TilemapRendererConfig } from '../../lib/Tilemap/TilemapRendererConfig'
import { GameLevel } from '../GameLevel.ts'
import terrain from './TestLevel2/TestLevel2.png'
import CanvasTexture = Phaser.Textures.CanvasTexture

export default class TestLevel2 extends GameLevel {
  registerEntities() {
    return [
      PortableMatterTank,
      Crate,
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
    builder.setRect(200, ref - 160, 160, 60, SOLID)
    builder.setRect(230, ref - 200, 60, 60, SOLID)
    builder.setRect(450, ref - 220, 60, 60, SOLID)
    builder.setRect(400, ref - 100, 200, 60, EMPTY)
    builder.setRect(400, ref - 100 - 5, 200, 60, WATER, undefined, 256, false)
    builder.setRect(200, ref - 100, 60, 60, PERMANENT)

    const centerX = 150
    const centerY = 400
    const width = 60
    const height = 100
    const thickness = 10

    builder.makeUTube(centerX, centerY, width, height, thickness, PERMANENT)
    builder.makePool({
      x: 600,
      y: ref - 100,
      width: 100,
      height: 100,
      thickness: 10,
      value: EMPTY,
    })
    builder.setRect(620, ref - 200, 20, 100, ACID, PLAYER_MATTER_TANK_ID)
    builder.setBorder(2, PERMANENT)

    return builder
  }

  makePlayer() {
    const player = new Player(this, 100, 300)
    const tank = this.entityFactory.spawn(PortableMatterTank, 220, 350, 99)

    player.matterTank.overflowTank = tank.matterTank
    return player
  }

  startLevel() {
    // this.entityFactory.spawn(Crate, 90, 50)
    super.startLevel()
  }
}
