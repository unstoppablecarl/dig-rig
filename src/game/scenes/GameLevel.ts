import { GameObjects, Geom, Input, Scene, Textures } from 'phaser'
import { loadPixelSpriteSheets } from '../../assets/asset-loader.ts'
import { PLAYER_SPRITE_SHEET_ASSETS } from '../../assets/player/player-sprite-sheet-assets.ts'
import { INPUT_ACTIONS, KEY_EVENT_GUARD } from '../../input.ts'
import { type BrushUIState, useBrushUIState } from '../../store/brushUIState.ts'
import { type UIState, useUIState } from '../../store/uiState.ts'
import { useWeaponUIState, type WeaponUIState } from '../../store/weaponUIState.ts'
import { type InstantWeaponUIState, useInstantWeaponUIState } from '../../store/weaponUIState/InstantWeaponUIState.ts'
import { DRAW_WORLD_BORDER_DEBUG } from '../config.ts'
import {
  MATTER_RENDER_CONFIG_DEFAULTS,
  type MatterRenderConfig,
  mergeMatterRenderConfig,
  type PartialMatterRenderConfig,
} from '../config/colors.ts'
import { getDeltaT } from '../helpers/_helpers.ts'
import { TerrainChunkBodyManager } from '../lib/Collision/TerrainChunkBodyManager.ts'
import { GAME_LEVEL_LOADED } from '../lib/events.ts'
import { WeaponManagerInput } from '../lib/Input/InputController/WeaponManagerInput.ts'
import { InputManager } from '../lib/Input/InputManager.ts'
import { makePlayerActions, type PlayerActions } from '../lib/Input/PlayerActions.ts'
import { MatterManager } from '../lib/Matter/Tank/MatterManager.ts'
import { DataManager } from '../lib/MatterEngine/DataManager.ts'
import { MatterEngine } from '../lib/MatterEngine/MatterEngine.ts'
import { Player } from '../lib/Player/Player.ts'
import { ProjectileManager } from '../lib/Projectiles/ProjectileManager.ts'
import { makePreviewProjectileRenderer, ProjectileRenderer } from '../lib/Projectiles/ProjectileRenderer.ts'
import { Tilemap } from '../lib/Tilemap/Tilemap.ts'
import { TilemapRenderer } from '../lib/Tilemap/TilemapRenderer.ts'
import type { TilemapRendererConfig } from '../lib/Tilemap/TilemapRendererConfig'
import { CameraController } from '../lib/UI/CameraController.ts'
import { VFXParticleManager } from '../lib/VFXParticles/VFXParticleManager.ts'
import { BgScene } from './Layers/BgScene.ts'
import { UIScene } from './Layers/UIScene.ts'
import type { LevelId, LevelInit } from './Levels'
import Group = GameObjects.Group
import Layer = GameObjects.Layer
import Rectangle = Geom.Rectangle
import MouseManager = Input.Mouse.MouseManager
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import WebGLTextureWrapper = Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper
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
  public vfxParticleManager: VFXParticleManager
  public player: Player
  public playerWeaponManager: WeaponManagerInput
  public projectiles: ProjectileManager
  public terrainChunkBodyManager: TerrainChunkBodyManager
  public tilemap: Tilemap
  public tilemapRenderer: TilemapRenderer
  public worldBounds: Geom.Rectangle
  public inputManager: InputManager
  public playerActions: PlayerActions
  public matterEngine: MatterEngine
  public uiState: UIState
  public weaponUIState: WeaponUIState
  public instantWeaponUIState: InstantWeaponUIState
  public brushUIState: BrushUIState
  public previewProjectileRenderer: ProjectileRenderer
  public matterRenderConfig: MatterRenderConfig
  public io: DataManager

  public ui: UIScene
  protected id: LevelId

  private nextFpsUpdate = 0

  protected makeTilemapRenderer(tilemap: Tilemap): TilemapRenderer {
    this.matterRenderConfig = mergeMatterRenderConfig(MATTER_RENDER_CONFIG_DEFAULTS, this.makeMatterRenderConfig())
    return new TilemapRenderer(
      this,
      this.getTerrainTexture(tilemap),
      this.tilemapRendererConfig(),
      this.matterRenderConfig,
    )
  }

  protected tilemapRendererConfig(): Partial<TilemapRendererConfig> {
    return {}
  }

  protected makeMatterRenderConfig(): PartialMatterRenderConfig {
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

  init(entry: LevelInit) {
    this.id = entry.id
    this.displayName = entry.displayName
    this.uiState = useUIState()
    this.uiState.levelId = this.id

    this.brushUIState = useBrushUIState()
    this.weaponUIState = useWeaponUIState()
    this.instantWeaponUIState = useInstantWeaponUIState()

    this.ui = this.registerSubScene(UIScene)
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
    this.terrainChunkBodyManager.trackAllDynamic()

    this.createUI()

    this.game.events.emit(GAME_LEVEL_LOADED, this.game, this)
  }

  private createUI() {
    this.scene
      .launch(UIScene.ID, { gameScene: this, levelId: this.id })
      .bringToTop(UIScene.ID)
      .launch(BgScene.ID, { gameScene: this })
      .sendToBack(BgScene.ID)

    if (this.matter.world.debugGraphic) {
      this.matter.world.debugGraphic.alpha = 0.75
    }
  }

  private preCreateLevel() {
    this.layers = this.makeLayers()
    this.previewProjectileRenderer = makePreviewProjectileRenderer(this)

    this.matterManager = new MatterManager(this)
    this.tilemap = this.makeTileMap()
    this.tilemap.initChunkSolidCounts()

    this.worldBounds = new Rectangle(0, 0,
      this.tilemap.width,
      this.tilemap.height,
    )

    this.tilemapRenderer = this.makeTilemapRenderer(this.tilemap)
    this.io = DataManager.make(this.tilemap)
    this.matterEngine = new MatterEngine(this)
    this.io = this.matterEngine.data
    this.terrainChunkBodyManager = new TerrainChunkBodyManager(this)
    this.projectiles = new ProjectileManager(this)
    this.playerActions = makePlayerActions(this, INPUT_ACTIONS, KEY_EVENT_GUARD)
    this.playerWeaponManager = new WeaponManagerInput(this)
    this.vfxParticleManager = new VFXParticleManager(this)
    this.inputManager = new InputManager(this)

    this.entities = this.add.group({
      runChildUpdate: true,
    })

    this.player = this.makePlayer()
    this.weaponUIState.activeMatterTank = this.player.matterTank

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

  update(time: number, delta: number) {
    const dt = getDeltaT(delta)

    if (time > this.nextFpsUpdate) {
      this.uiState.fps = Math.floor(this.game.loop.actualFps)
      this.nextFpsUpdate = time + 500
    }

    this.matterEngine.update()
    this.cameraController.update()
    this.player.update()
    this.projectiles.update(dt)
    this.terrainChunkBodyManager.update()

    this.tilemapRenderer.render()
  }

  initCanvasTexture(key: string, width: number, height: number) {
    if (this.textures.exists(key)) this.textures.remove(key)
    const effectTexture = this.textures.createCanvas(key, width, height)!
    effectTexture.refresh()
    effectTexture.source[0].setFilter(NEAREST)

    return effectTexture
  }

  initGLTexture(key: string, width: number, height: number): [Phaser.Textures.Texture, WebGLTextureWrapper] {
    if (this.textures.exists(key)) this.textures.remove(key)
    const renderer = this.renderer as WebGLRenderer
    const gl = renderer.gl
    const wrapper = renderer.createTexture2D(
      0, gl.NEAREST, gl.NEAREST, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE,
      gl.RGBA, undefined, width, height, false, true, false,
    )
    const texture = this.textures.addGLTexture(key, wrapper)!
    return [texture, wrapper]
  }

  private registerSubScene<T extends { ID: string, new(): E }, E>(Def: T): E {
    if (!this.scene.get(Def.ID)) {
      this.scene.add(Def.ID, Def)
    }
    return this.scene.get(Def.ID) as E
  }
}