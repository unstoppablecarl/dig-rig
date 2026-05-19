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