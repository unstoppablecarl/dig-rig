import { GameObjects, Geom, Input, Scene, Textures } from 'phaser'
import { loadPixelSpriteSheets } from '../../assets/asset-loader.ts'
import { PLAYER_SPRITE_SHEET_ASSETS } from '../../assets/player/player-sprite-sheet-assets.ts'
import { INPUT_ACTIONS } from '../../input.ts'
import { DRAW_WORLD_BORDER_DEBUG } from '../config.ts'
import { getDeltaT } from '../helpers/_helpers.ts'
import { TerrainChunkBodyManager } from '../lib/Collision/TerrainChunkBodyManager.ts'
import { WeaponManagerInput } from '../lib/Input/InputControllers/WeaponManagerInput.ts'
import { InputManager } from '../lib/Input/InputManager.ts'
import { makePlayerActions, type PlayerActions } from '../lib/Input/PlayerActions.ts'
import { MatterManager } from '../lib/Matter/MatterManager.ts'
import { ParticleManager } from '../lib/Particles/ParticleManager.ts'
import { TerrainParticleManager } from '../lib/Particles/TerrainParticleManager.ts'
import { Player } from '../lib/Player/Player.ts'
import { ProjectileManager } from '../lib/Projectiles/ProjectileManager.ts'
import { Tilemap } from '../lib/Tilemap/Tilemap.ts'
import { TilemapRenderer, type TilemapRendererConfig } from '../lib/Tilemap/TilemapRenderer.ts'
import { CameraController } from '../lib/UI/CameraController.ts'
import { BgScene } from './Layers/BgScene.ts'
import { UIScene } from './Layers/UIScene.ts'
import type { LevelEntryWithId, LevelId } from './Levels'
import Group = GameObjects.Group
import Layer = GameObjects.Layer
import Rectangle = Geom.Rectangle
import MouseManager = Input.Mouse.MouseManager
import CanvasTexture = Phaser.Textures.CanvasTexture
import NEAREST = Textures.FilterMode.NEAREST

type Layers = {
  bg: Layer,
  terrain: Layer,
  terrainParticles: Layer,
  terrainEffect: Layer,
  terrainDebug: Layer,
  physicsObjects: Layer,
  player: Layer,
  enemies: Layer,
  brush: Layer,
  projectile: Layer,
}

export abstract class GameLevel extends Scene {
  public displayName = 'Level Name Not Loaded'
  public layers: Layers
  public cameraController: CameraController
  public entities: Group
  public matterManager: MatterManager
  public particleManager: ParticleManager
  public player: Player
  public playerWeaponManager: WeaponManagerInput
  public projectiles: ProjectileManager
  public terrainChunkBodyManager: TerrainChunkBodyManager
  public tilemap: Tilemap
  public tilemapRenderer: TilemapRenderer
  public worldBounds: Geom.Rectangle
  public inputManager: InputManager
  public playerActions: PlayerActions
  public terrainParticleManager: TerrainParticleManager
  protected id: LevelId

  protected makeTilemapRenderer(tilemap: Tilemap): TilemapRenderer {
    return new TilemapRenderer(this, this.getTerrainTexture(tilemap), this.tilemapRendererConfig())
  }

  protected tilemapRendererConfig(): Partial<TilemapRendererConfig> {
    return {}
  }

  protected abstract getTerrainTexture(tilemap: Tilemap): CanvasTexture

  startLevel() {
  }

  abstract makeTileMap(): Tilemap

  abstract makePlayer(): Player

  makeLayers(): Layers {
    return {
      bg: this.add.layer(),
      terrain: this.add.layer(),
      terrainParticles: this.add.layer(),
      terrainEffect: this.add.layer(),
      terrainDebug: this.add.layer(),
      physicsObjects: this.add.layer(),
      enemies: this.add.layer(),
      player: this.add.layer(),
      brush: this.add.layer(),
      projectile: this.add.layer(),
    }
  }

  init(entry: LevelEntryWithId) {
    this.id = entry.id
    this.displayName = entry.displayName
    this.registerSubScene(UIScene)
    this.registerSubScene(BgScene)

    const mouse = this.input.mouse as MouseManager
    mouse.disableContextMenu()
  }

  preload() {
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2
    const barW = 320
    const barH = 24

    const title = this.add.text(cx, cy - 60,
      `Loading ${this.displayName}...`,
      { fontSize: '20px' })
      .setOrigin(0.5)

    const outline = this.add.graphics()
      .lineStyle(2, 0xffffff, 1)
      .strokeRect(cx - barW / 2, cy - barH / 2, barW, barH)

    const fill = this.add.graphics()
    const pct = this.add.text(cx, cy + 40, '0%',
      { fontSize: '18px' }).setOrigin(0.5)

    this.load.on('progress', (v: number) => {
      fill.clear()
        .fillStyle(0x00b4ff, 1)
        .fillRect(cx - barW / 2 + 2, cy - barH / 2 + 2,
          (barW - 4) * v, barH - 4)
      pct.setText(`${Math.round(v * 100)}%`)
    })

    // Clean up the UI once loading finishes, before create() runs
    this.load.once('complete', () => {
      title.destroy()
      outline.destroy()
      fill.destroy()
      pct.destroy()
    })
  }

  preloadPlayer() {
    loadPixelSpriteSheets(this, PLAYER_SPRITE_SHEET_ASSETS)
  }

  loadPrefixedPixelImage(key: string, url: string) {
    const id = this.id + '_' + key

    this.loadPixelImage(id, url)

    return id
  }

  loadPixelImage(key: string, url: string) {
    this.load.image(key, url)
    this.load.once(`filecomplete-image-${key}`,
      () => this.textures.get(key).setFilter(NEAREST))
  }

  create() {
    this.preCreateLevel()

    this.startLevel()

    this.createUI()
  }

  private createUI() {
    this.scene
      .launch(UIScene.ID, { gameScene: this })
      .bringToTop(UIScene.ID)
      .launch(BgScene.ID, { gameScene: this })
      .sendToBack(BgScene.ID)

    if (this.matter.world.debugGraphic) {
      this.matter.world.debugGraphic.alpha = 0.75
    }
  }

  private preCreateLevel() {
    this.layers = this.makeLayers()

    this.matterManager = new MatterManager(this)
    this.tilemap = this.makeTileMap()

    this.worldBounds = new Rectangle(0, 0,
      this.tilemap.width,
      this.tilemap.height,
    )

    this.terrainParticleManager = new TerrainParticleManager(this)
    this.tilemapRenderer = this.makeTilemapRenderer(this.tilemap)
    this.terrainChunkBodyManager = new TerrainChunkBodyManager(this)
    this.projectiles = new ProjectileManager(this)
    this.playerActions = makePlayerActions(this, INPUT_ACTIONS)
    this.playerWeaponManager = new WeaponManagerInput(this)
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
  }

  update(_time: number, delta: number) {
    const dt = getDeltaT(delta)

    this.cameraController.update()
    this.player.update()
    this.projectiles.update(dt)
    this.terrainChunkBodyManager.update()
    this.terrainParticleManager.update(dt)

    this.tilemapRenderer.render()
  }

  initCanvasTexture(key: string, width: number, height: number) {
    if (this.textures.exists(key)) this.textures.remove(key)
    const effectTexture = this.textures.createCanvas(key, width, height)!
    effectTexture.refresh()
    effectTexture.source[0].setFilter(NEAREST)

    return effectTexture
  }

  private registerSubScene(Def: { ID: string, new(): any }) {
    if (!this.scene.get(Def.ID)) {
      this.scene.add(Def.ID, Def)
    }
  }
}