import NEAREST = Phaser.Textures.NEAREST
import ImageFrameConfig = Phaser.Types.Loader.FileTypes.ImageFrameConfig
import type { Scene } from 'phaser'
import type { SpriteSheetLoader } from './_asset-loader-types.ts'

export function loadSpriteSheet() {

}

export function loadPixelImage(
  scene: Pick<Scene, 'load' | 'textures'>,
  key: string,
  url: string,
) {
  scene.load.image(key, url)
  scene.load.once(`filecomplete-image-${key}`,
    () => scene.textures.get(key).setFilter(NEAREST))
}

export function loadPixelSpritesheet(
  scene: Pick<Scene, 'load' | 'textures'>,
  key: string,
  url: string,
  config: ImageFrameConfig,
) {
  scene.load.spritesheet(key, url, config)
  scene.load.once(`filecomplete-spritesheet-${key}`,
    () => scene.textures.get(key).setFilter(NEAREST))
}

export function loadPixelSpriteSheets(
  scene: Pick<Scene, 'load' | 'textures'>,
  spriteSheets: Record<string, SpriteSheetLoader>,
) {
  for (const [key, { url, config }] of Object.entries(spriteSheets)) {
    console.log(key, url, config)
    loadPixelSpritesheet(scene, key, url, config)
  }
}