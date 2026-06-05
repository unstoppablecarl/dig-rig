// usage: game.events.on(GAME_LEVEL_LOADED, (scene: GameLevel) => {})
export const GAME_LEVEL_LOADED = 'GAME_LEVEL_LOADED' as const

// usage: scene.EVENTS.on(GameEvent.*, () => {})
export enum GameEvent {
  MESSAGE = 'MESSAGE',
}

export interface EventMap {
  [GameEvent.MESSAGE]: [string]
}

