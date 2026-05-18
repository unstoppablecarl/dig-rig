import type { Scene } from 'phaser'

export interface LevelEntry {
  displayName: string
  load: () => Promise<{ default: new () => Scene }>
}

export interface LevelEntryWithId extends LevelEntry {
  id: LevelId
}

export type LevelId = keyof typeof LEVELS

export const LEVELS = {
  LEVEL_1: {
    displayName: 'Test Level',
    load: () => import('./TestLevel'),
  },
  LEVEL_2: {
    displayName: 'Test Level 2',
    load: () => import('./TestLevel2'),
  },
  LEVEL_3: {
    displayName: 'Test Level 3',
    load: () => import('./ImageSourceTestLevel'),
  },
} as const satisfies Record<string, LevelEntry>