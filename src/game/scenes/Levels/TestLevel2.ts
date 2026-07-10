import type { PartialMatterRenderConfig } from '../../config/colors.ts'
import { Crate } from '../../lib/Entities/defs/Crate.ts'
import { PortableMatterTank } from '../../lib/Entities/defs/PortableMatterTank.ts'
import { EMPTY, PERMANENT, setSettled, SOLID, WATER } from '../../lib/Matter/_Matter.types.ts'
import { Player } from '../../lib/Player/Player.ts'
import { Tilemap } from '../../lib/Tilemap/Tilemap.ts'
import { TilemapMutator } from '../../lib/Tilemap/TilemapMutator.ts'
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
    const tilemap = new Tilemap(
      this,
      2000,
      1000,
    )

    let ref = 600
    tilemap.setRect(0, ref - 100, tilemap.width, 500, SOLID)
    tilemap.setRect(200, ref - 160, 160, 60, SOLID)
    tilemap.setRect(230, ref - 200, 60, 60, SOLID)
    tilemap.setRect(450, ref - 220, 60, 60, SOLID)
    tilemap.setRect(400, ref - 100, 100, 60, EMPTY)
    tilemap.setRect(400, ref - 100 - 5, 100, 60, setSettled(WATER, false), 256)
    tilemap.setRect(200, ref - 100, 60, 60, PERMANENT)
    const mutator = new TilemapMutator(tilemap)

    // mutator.makeBox(1000, 400, 300, 700, 10, PERMANENT)
    // tilemap.setRect(600, 400, 200, 200, PERMANENT)
    // tilemap.setRect(610, 410, 180, 180, EMPTY)
    //
    // tilemap.setRect(610, 510, 180, 80, setSettled(ACID, false), 256)

    const centerX = 150
    const centerY = 400
    const width = 60
    const height = 100
    const thickness = 10

    mutator.makeUTube(centerX, centerY, width, height, thickness, PERMANENT)
    // mutator.makeBowl(300, 400, 100, 100, 10, PERMANENT)
    tilemap.setBorder(2, PERMANENT)
    return tilemap
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
