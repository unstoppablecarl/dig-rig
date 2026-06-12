import type { Scene } from 'phaser'

export type RestartableTimerEvent = ReturnType<typeof makeRestartableTimerEvent>

export function makeRestartableTimerEvent(scene: Scene, config: Phaser.Types.Time.TimerEventConfig) {
  const event = scene.time.addEvent({ ...config, paused: true })

  return {
    start() {
      if (!event.paused) return
      event.elapsed = 0
      event.paused = false
    },

    stop() {
      event.paused = true
    },

    destroy() {
      event.destroy()
    },
  }
}
