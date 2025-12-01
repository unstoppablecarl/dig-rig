import type { GameLevel } from '../../scenes/GameLevel.ts'
import { TerrainType } from './TileMap.ts'
import { TERRAIN_TYPE_TRANSITION_COLORS, TILE_SIZE } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import Layer = Phaser.GameObjects.Layer
import Graphics = Phaser.GameObjects.Graphics

export class TileMapBasicRenderer extends SceneBound {
  public layer: Layer
  public debugLayer: Layer
  public graphics: Graphics

  private matter = 0

  public constructor(
    public scene: GameLevel,
  ) {
    super(scene)
    this.layer = scene.layers.terrain
    this.debugLayer = scene.layers.terrainDebug

    this.graphics = this.scene.add.graphics()
    this.layer.add(this.graphics)
  }

  public render() {
    this.graphics.clear()
    this.matter = 0

    const tilemap = this.scene.tilemap
    // Draw tiles
    for (let y = 0; y < tilemap.height; y++) {
      for (let x = 0; x < tilemap.width; x++) {
        let tileType = tilemap.getTile(x, y)
        if (tileType !== TerrainType.EMPTY) {

          let color: number
          if (tileType === TerrainType.PERMANENT) {
            color = TERRAIN_TYPE_TRANSITION_COLORS[TerrainType.PERMANENT]
          } else {
            this.matter++
            // Vary color slightly for visual interest
            const shade = 0x44 + ((x + y) % 3) * 0x11
            color = (shade << 16) | (shade << 8) | shade
          }
          this.graphics.fillStyle(color, 1)
          this.graphics.fillRect(
            x * TILE_SIZE,
            y * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE,
          )
        }
      }
    }
  }
}