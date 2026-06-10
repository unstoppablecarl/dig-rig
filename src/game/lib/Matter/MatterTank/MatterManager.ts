import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { MatterTank } from './MatterTank.ts'

export class MatterManager extends SceneBound {
  public matterTanks = new Map<number, MatterTank>
  public playerMatterTank: MatterTank

  // must start at 1, 0 = no owner
  protected idIncrement = 1

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
  }

  makePlayerMatterTank(
    matterMax = 5000,
    matter = 0,
    tweenFrom = 0,
  ) {
    this.playerMatterTank = new MatterTank(
      this,
      0,
      matterMax,
      matter,
      tweenFrom,
    )

    return this.playerMatterTank
  }

  makeMatterTank(
    matterMax: number,
    matter: number,
  ) {

    let id = this.idIncrement++
    const tank = new MatterTank(
      this,
      id,
      matterMax,
      matter,
    )

    this.matterTanks.set(id, tank)

    return tank
  }

  universeMatter() {
    return this.playerMatter() + this.terrainMatter() + this.enemiesMatter()
  }

  terrainMatter() {
    return this.scene.tilemap.totalMatter()
  }

  enemiesMatter() {
    let sum = 0

    for (const tank of this.matterTanks.values()) {
      sum += tank.matterContained()
    }
    return sum
  }

  playerMatter() {
    return this.playerMatterTank.matterContained()
  }

  remove(tank: MatterTank) {
    this.matterTanks?.delete(tank.id)
  }

  protected onDestroy() {
    this.playerMatterTank?.destroy()
    for (const tank of this.matterTanks.values()) {
      tank.destroy()
    }
    // @ts-expect-error: destroy
    this.playerMatterTank = null
    // @ts-expect-error: destroy
    this.matterTanks = null
  }
}