import { Input, Scene } from 'phaser'
import { AUTO_START_LEVEL_INDEX } from '../config.ts'
import { launchLevel } from '../launcher.ts'
import { type LevelEntry, type LevelId, LEVELS } from './Levels'
import POINTER_DOWN = Input.Events.POINTER_DOWN

export class LevelSelect extends Scene {
  static ID = 'LevelSelect'

  constructor() {
    super(LevelSelect.ID)
  }

  create() {
    const lastLevelId = localStorage.getItem('level') as null | LevelId
    if (lastLevelId) {
      launchLevel(lastLevelId)
      return
    }

    if (AUTO_START_LEVEL_INDEX > -1) {
      launchLevel(Object.keys(LEVELS)[AUTO_START_LEVEL_INDEX] as LevelId)
      return
    }

    let y = 0
    for (const [id, entry] of Object.entries(LEVELS) as [LevelId, LevelEntry][]) {
      y += 150
      this.makeButton(100, y, id, entry)
    }
  }

  private makeButton(x: number, y: number, id: LevelId, entry: LevelEntry) {
    const button = this.add.text(x, y, entry.displayName)
      .setFontSize(100)
      .setBackgroundColor('#000')
      .setPadding(40, 20)
      .setInteractive()

    button.on(POINTER_DOWN, () => launchLevel(id))
  }
}