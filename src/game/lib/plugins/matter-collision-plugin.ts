import { PhaserMatterCollisionPlugin } from 'phaser-matter-collision-plugin'

export const pluginMatterCollisionConfig = {
  plugin: PhaserMatterCollisionPlugin,
  // scene.sys.matterCollision:
  key: 'matterCollision' as 'matterCollision',
  // scene.matterCollision:
  mapping: 'matterCollision' as 'matterCollision',
}

declare module 'phaser' {
  interface Scene {
    [pluginMatterCollisionConfig.mapping]: PhaserMatterCollisionPlugin;
  }

  namespace Scenes {
    interface Systems {
      [pluginMatterCollisionConfig.key]: PhaserMatterCollisionPlugin;
    }
  }
}