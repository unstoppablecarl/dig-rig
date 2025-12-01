import { Scene } from 'phaser'
import { AUTO_START_LEVEL_INDEX } from '../config.ts'
import { TestLevel } from './Levels/TestLevel.ts'
import { TestLevel2 } from './Levels/TestLevel2.ts'
import POINTER_DOWN = Phaser.Input.Events.POINTER_DOWN

export const LEVEL_CLASSES = [
  TestLevel,
  TestLevel2,
]

export class LevelSelect extends Scene {
  static ID = 'LevelSelect'

  constructor() {
    super(LevelSelect.ID)
  }

  init() {
    for (const level of LEVEL_CLASSES) {
      this.scene.add(level.ID, new level())
    }
  }

  create() {
    let y = 0
    for (const level of LEVEL_CLASSES) {
      y += 150
      this.makeButton(100, y, level.DISPLAY_NAME, level)
    }

    if (AUTO_START_LEVEL_INDEX > -1) {
      this.scene.start(LEVEL_CLASSES[AUTO_START_LEVEL_INDEX].ID)
    }
  }

  makeButton(x: number, y: number, name: string, sceneId: any) {
    const button = this.add.text(x, y, name)
      .setFontSize(100)
      .setBackgroundColor('#000')
      .setPadding(40, 20)
      .setInteractive()

    button.on(POINTER_DOWN, () => this.scene.start(sceneId.ID))
  }
}