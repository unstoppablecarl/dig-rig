import type { Scene } from 'phaser'

export interface LevelEntry {
  displayName: string
  load: () => Promise<{ default: new () => Scene }>
}

export type LevelId = keyof typeof LEVELS

export const LEVELS = {
  LEVEL_1: {
    displayName: 'Test Level',
    load:
      () => import('./TestLevel'),
  },
  LEVEL_2: {
    displayName: 'Test Level 2',
    load:
      () => import('./TestLevel2'),
  },
} as const satisfies Record<string, LevelEntry>