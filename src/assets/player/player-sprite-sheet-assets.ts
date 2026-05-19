import type { Scene } from 'phaser'
import type { SpriteSheetLoader } from '../_asset-loader-types.ts'
import playerArmImg from './arm.png'
import playerImg from './player.png'

export enum PlayerSpriteSheetAssets {
  player = 'player',
  player_arm = 'player-arm',
}

export const PLAYER_SPRITE_SHEET_ASSETS: Record<PlayerSpriteSheetAssets, SpriteSheetLoader> = {
  [PlayerSpriteSheetAssets.player]: {
    url: playerImg,
    config: { frameWidth: 40, frameHeight: 40 },
  },
  [PlayerSpriteSheetAssets.player_arm]: {
    url: playerArmImg,
    config: { frameWidth: 18, frameHeight: 8 },
  },
}

export function makePlayerSprite(scene: Scene) {
  const PLAYER = PlayerSpriteSheetAssets.player

  const sprite = scene.add.sprite(0, 0, PLAYER)

  sprite.anims.create({
    key: 'idle',
    frames: scene.anims.generateFrameNumbers(PLAYER, { frames: [0] }),
    frameRate: 8,
    repeat: -1,
  })

  const walkFrames = [0, 1, 2, 3, 4, 5]
  sprite.anims.create({
    key: 'walk',
    frames: scene.anims.generateFrameNumbers(PLAYER, { frames: walkFrames }),
    frameRate: 14,
    repeat: -1,
  })

  sprite.anims.create({
    key: 'walk-reverse',
    frames: scene.anims.generateFrameNumbers(PLAYER, { frames: [...walkFrames].reverse() }),
    frameRate: 14,
    repeat: -1,
  })

  sprite.anims.create({
    key: 'hurt',
    frames: scene.anims.generateFrameNumbers(PLAYER, { frames: [12, 13] }),
    frameRate: 2,
    repeat: -1,
  })

  sprite.anims.create({
    key: 'fall',
    frames: scene.anims.generateFrameNumbers(PLAYER, { frames: [7] }),
  })

  sprite.anims.create({
    key: 'jump',
    frames: scene.anims.generateFrameNumbers(PLAYER, { frames: [6] }),
  })

  return sprite
}