import type { UIState } from '../../../store/uiState.ts'
import type { GameLevel } from '../GameLevel.ts'

export interface LevelEntry {
  displayName: string
  load: () => Promise<{ default: new () => GameLevel }>
}

export interface LevelInit extends LevelEntry {
  id: LevelId,
  uiState: UIState
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
  BENCH: {
    displayName: 'Bench: Oil Flood',
    load: () => import('././BenchLevelFluid.ts'),
  },
  BENCH_SAND: {
    displayName: 'Bench: Sand Fall',
    load: () => import('./BenchLevelSand'),
  },
  TEST_WATER: {
    displayName: 'Test: Water Drain',
    load: () => import('././WaterLevelDrain.ts'),
  },
} as const satisfies Record<string, LevelEntry>