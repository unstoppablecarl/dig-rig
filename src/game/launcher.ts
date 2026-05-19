import { Game } from 'phaser'
import { type LevelId, LEVELS } from './scenes/Levels'

let game: Game

export function setGame(g: Game) {
  game = g
}

export async function launchLevel(id: LevelId) {
  const entry = LEVELS[id]
  if (!entry) {
    console.warn(`Unknown level: ${id}`)
    return
  }

  localStorage.setItem('level', id)

  if (!game.scene.getScene(id)) {
    const module = await entry.load()
    game.scene.add(id, module.default, false, { ...entry, id })
  }

  for (const active of game.scene.getScenes(true)) {
    if (active.scene.key !== id) active.scene.stop()
  }

  game.scene.start(id)
}
