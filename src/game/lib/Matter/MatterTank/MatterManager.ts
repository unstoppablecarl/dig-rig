import { DEFAULT_PLAYER_MATTER_TANK_SIZE } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { type MatterTankId, type MatterTankSource, PLAYER_MATTER_TANK_ID } from './_MatterTank.types.ts'
import { MatterTank } from './MatterTank.ts'

export class MatterManager extends SceneBound {
  public matterTanks = new Map<MatterTankId, MatterTank>
  public playerMatterTank: MatterTank

  // must start at 0 = no owner, 1 = player
  protected idIncrement = 2

  constructor(
    public scene: GameLevel,
  ) {
    super(scene)
  }

  makePlayerMatterTank(
    player: MatterTankSource,
    matter = 0,
    matterMax = DEFAULT_PLAYER_MATTER_TANK_SIZE,
    tweenFrom = 0,
  ) {
    this.playerMatterTank = new MatterTank(
      this,
      player,
      PLAYER_MATTER_TANK_ID,
      matterMax,
      matter,
      tweenFrom,
    )
    this.matterTanks.set(PLAYER_MATTER_TANK_ID, this.playerMatterTank)

    return this.playerMatterTank
  }

  makeMatterTank(
    source: MatterTankSource,
    matterMax: number,
    matter: number = 0,
  ) {

    const id = this.idIncrement++ as MatterTankId
    const tank = new MatterTank(
      this,
      source,
      id,
      matterMax,
      matter,
    )

    this.matterTanks.set(id, tank)

    return tank
  }

  universeMatter(): number {
    return this.allTankMatter() + this.terrainMatter()
  }

  terrainMatter(): number {
    if (this.destroyed) return 0
    return this.scene.tilemap.totalMatter()
  }

  nonPlayerTankMatter(): number {
    let sum = 0

    for (const tank of this.matterTanks.values()) {
      if (tank !== this.playerMatterTank) {
        sum += tank.matterContained()
      }
    }
    return sum
  }

  playerMatter(): number {
    if (this.destroyed) return 0
    return this.playerMatterTank.matterContained()
  }

  allTankMatter(): number {
    if (this.destroyed) return 0
    let sum = 0
    for (const tank of this.matterTanks.values()) {
      sum += tank.matterContained()
    }
    return sum
  }

  get(id: MatterTankId) {
    return this.matterTanks.get(id)
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