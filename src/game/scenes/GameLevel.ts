import { GameObjects, Geom, Input, Scene } from 'phaser'
import { DRAW_DEBUG_TILEMAP, DRAW_WORLD_BORDER_DEBUG, TILE_SIZE } from '../config.ts'
import { getDeltaT } from '../helpers/_helpers.ts'
import { makePatterns, type PatternStore } from '../helpers/patterns.ts'
import { TerrainChunkBodyManager } from '../lib/Collision/TerrainChunkBodyManager.ts'
import { InputManager } from '../lib/Input/InputManager.ts'
import { MatterManager } from '../lib/Matter/MatterManager.ts'
import { ParticleManager } from '../lib/Particles/ParticleManager.ts'
import { TerrainParticleManager } from '../lib/Particles/TerrainParticleManager.ts'
import { Player } from '../lib/Player/Player.ts'
import { PlayerWeaponManager } from '../lib/Player/Weapons/PlayerWeaponManager.ts'
import { ProjectileManager } from '../lib/Projectiles/ProjectileManager.ts'
import { Tilemap } from '../lib/TileMap/TileMap.ts'
import { TileMapBasicRenderer } from '../lib/TileMap/TileMapBasicRenderer.ts'
import { TileMapChunkRenderer } from '../lib/TileMap/TileMapChunkRenderer.ts'
import { CameraController } from '../lib/UI/CameraController.ts'
import { BgScene } from './Layers/BgScene.ts'
import { UIScene } from './Layers/UIScene.ts'
import Group = GameObjects.Group
import Layer = GameObjects.Layer
import Rectangle = Geom.Rectangle
import MouseManager = Input.Mouse.MouseManager

type Layers = {
  bg: Layer,
  terrain: Layer,
  terrainParticles: Layer,
  terrainEffect: Layer,
  terrainDebug: Layer,
  player: Layer,
  enemies: Layer,
  brush: Layer,
  projectile: Layer,
}

export abstract class GameLevel extends Scene {
  static ID: string
  static DISPLAY_NAME = 'Unnamed'

  public layers: Layers
  public basicTilemapRenderer: TileMapBasicRenderer
  public cameraController: CameraController
  public entities: Group
  public matterManager: MatterManager
  public particleManager: ParticleManager
  public patternStore: PatternStore
  public player: Player
  public playerWeaponManager: PlayerWeaponManager
  public projectiles: ProjectileManager
  public terrainChunkBodyManager: TerrainChunkBodyManager
  public tilemap: Tilemap
  public tilemapRenderer: TileMapChunkRenderer
  public worldBounds: Geom.Rectangle
  public inputManager: InputManager
  public terrainParticleManager: TerrainParticleManager

  abstract startLevel(): void

  abstract makeTileMap(): Tilemap

  abstract makePlayer(): Player

  makeLayers(): Layers {
    return {
      bg: this.add.layer(),
      terrain: this.add.layer(),
      terrainParticles: this.add.layer(),
      terrainEffect: this.add.layer(),
      terrainDebug: this.add.layer(),
      enemies: this.add.layer(),
      player: this.add.layer(),
      brush: this.add.layer(),
      projectile: this.add.layer(),
    }
  }

  init() {
    this.registerScene(UIScene)
    this.registerScene(BgScene)

    const mouse = this.input.mouse as MouseManager
    mouse.disableContextMenu()
  }

  create() {
    this.layers = this.makeLayers()

    this.patternStore = makePatterns(this.textures)
    this.matterManager = new MatterManager(this)

    this.tilemap = this.makeTileMap()

    this.worldBounds = new Rectangle(0, 0,
      this.tilemap.width * TILE_SIZE,
      this.tilemap.height * TILE_SIZE,
    )

    if (DRAW_DEBUG_TILEMAP) {
      this.basicTilemapRenderer = new TileMapBasicRenderer(this)
    }
    this.terrainParticleManager = new TerrainParticleManager(this)
    this.tilemapRenderer = new TileMapChunkRenderer(this)
    this.terrainChunkBodyManager = new TerrainChunkBodyManager(this)
    this.projectiles = new ProjectileManager(this)
    this.playerWeaponManager = new PlayerWeaponManager(this)
    this.particleManager = new ParticleManager(this)
    this.inputManager = new InputManager(this)

    this.entities = this.add.group({
      runChildUpdate: true,
    })

    this.player = this.makePlayer()

    this.matter.world.setBounds(
      0, 0,
      this.worldBounds.width,
      this.worldBounds.height,
    )

    this.cameraController = new CameraController(this)

    if (DRAW_WORLD_BORDER_DEBUG) {
      const worldWidth = this.worldBounds.width
      const worldHeight = this.worldBounds.height
      this.add.graphics()
        .lineStyle(1, 0x00ff00, 1)
        .strokeRect(0, 0, worldWidth, worldHeight)
    }

    this.startLevel()

    this.scene.launch(UIScene.ID, { gameScene: this })
    this.scene.launch(BgScene.ID, { gameScene: this })
      .sendToBack(BgScene.ID)

    if (this.matter.world.debugGraphic) {
      this.matter.world.debugGraphic.alpha = 0.75
    }
  }

  update(_time: number, delta: number) {
    const dt = getDeltaT(delta)

    this.cameraController.update()
    this.player.update(dt)
    this.projectiles.update(dt)
    this.terrainChunkBodyManager.update()
    this.terrainParticleManager.update(dt)

    if (DRAW_DEBUG_TILEMAP) this.basicTilemapRenderer.render()

    this.tilemapRenderer.render()
  }

  private registerScene(Def: { ID: string, new(): any }) {
    if (this.scene.isActive(Def.ID)) return

    this.scene.add(Def.ID, new Def())
  }
}