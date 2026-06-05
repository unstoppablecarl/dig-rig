import { Game } from 'phaser'
import { useUIState } from '../store/uiState.ts'
import { type LevelId, type LevelInit, LEVELS } from './scenes/Levels'

let game: Game

export function setGame(g: Game) {
  game = g
}

export async function launchLevel(id: LevelId) {
  const entry = LEVELS[id]
  if (!entry) {
    console.error(`invalid level: ${id}`)
    return
  }

  localStorage.setItem('level', id)

  if (!game.scene.getScene(id)) {
    const module = await entry.load()
    // guard against concurrent launchLevel calls
    if (!game.scene.getScene(id)) {
      const data: LevelInit = { ...entry, id, uiState: useUIState() }
      game.scene.add(id, module.default, false, data)
    }
  }

  for (const active of game.scene.getScenes(true)) {
    if (active.scene.key !== id) active.scene.stop()
  }

  game.scene.start(id)
}
