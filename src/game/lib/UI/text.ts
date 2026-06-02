import type { Scene } from 'phaser'

export function makeFPSText(scene: Scene) {
  return makeTextUpdate('fps-text', () => 'FPS: ' + Math.floor(scene.game.loop.actualFps), 500)
}

export function makeTextUpdate(id: string, getValue: () => string | number, throttleMs = 0) {
  const el = document.getElementById(id) as HTMLElement
  let last = ''
  let nextAllowed = 0
  return (now = performance.now()) => {
    if (now < nextAllowed) return
    nextAllowed = now + throttleMs
    const val = '' + getValue()
    if (val === last) return
    last = val
    el.textContent = val
  }
}