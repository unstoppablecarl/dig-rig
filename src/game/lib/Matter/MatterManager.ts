import type { GameLevel } from '../../scenes/GameLevel.ts'
import { MatterTank } from './MatterTank.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'

export class MatterManager extends SceneBound {
  public matterTanks = new Set<MatterTank>
  public playerMatterTank: MatterTank

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

    const tank = new MatterTank(
      this,
      matterMax,
      matter,
    )

    this.matterTanks.add(tank)

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

    for (const tank of this.matterTanks) {
      sum += tank.matterContained()
    }
    return sum
  }

  playerMatter() {
    return this.playerMatterTank.matterContained()
  }

  remove(tank: MatterTank) {
    this.matterTanks?.delete(tank)
  }

  protected onDestroy() {
    this.playerMatterTank?.destroy()
    for (const tank of this.matterTanks) {
      tank.destroy()
    }
    // @ts-expect-error: destroy
    this.playerMatterTank = null
    // @ts-expect-error: destroy
    this.matterTanks = null
  }
}