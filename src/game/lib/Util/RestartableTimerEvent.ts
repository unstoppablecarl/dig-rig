import TimerEvent = Phaser.Time.TimerEvent

export class RestartableTimerEvent extends TimerEvent {
  constructor(config: Phaser.Types.Time.TimerEventConfig) {
    super(config)
    this.paused = true
  }

  stop() {
    this.paused = true
  }

  start() {
    this.elapsed = 0
    this.paused = false
  }
}