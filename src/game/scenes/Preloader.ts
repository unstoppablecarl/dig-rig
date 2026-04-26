import { Loader, Scene, Textures } from 'phaser'
import PROGRESS = Loader.Events.PROGRESS
import NEAREST = Textures.FilterMode.NEAREST

export class Preloader extends Scene {
  constructor() {
    super('Preloader')
  }

  init() {
    //  We loaded this image in our Boot Scene, so we can display it here
    this.add.image(512, 384, 'background')

    //  A simple progress bar. This is the outline of the bar.
    this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff)

    //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
    const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff)

    //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
    this.load.on(PROGRESS, (progress: number) => {

      //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
      bar.width = 4 + (460 * progress)

    })
  }

  preload() {
    this.load.setPath('assets')
    this.load.image('rock-tile', 'tiles/rock.png')
    // this.load.image('rock-tile', 'tiles/stone.png')

    this.load.image('enemy', 'enemy-2.png')

    this.load.spritesheet('player', 'player.png', { frameWidth: 40, frameHeight: 40 })
    this.load.spritesheet('player-arm', 'arm.png', { frameWidth: 18, frameHeight: 8 })
  }

  create() {
    this.textures.get('player').setFilter(NEAREST)
    this.textures.get('player-arm').setFilter(NEAREST)
    this.textures.get('rock-tile').setFilter(NEAREST)
    this.textures.get('enemy').setFilter(NEAREST)

    this.scene.start('LevelSelect')
  }
}