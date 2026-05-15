import type { Scene } from 'phaser'

export function makeFPSText(scene: Scene) {
  return makeTextUpdate('fps-text', () => 'FPS: ' + Math.floor(scene.game.loop.actualFps))
}

export function makeTextUpdate(id: string, getValue: () => string | number) {
  const el = document.getElementById(id) as HTMLElement
  return () => el.innerHTML = '' + getValue()
}