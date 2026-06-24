import { DEFAULT_PLAYER_MATTER_TANK_SIZE } from '../../../config.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import { type MatterTankId, type MatterTankSource, PLAYER_MATTER_TANK_ID } from './_MatterTank.types.ts'
import { MatterTank } from './MatterTank.ts'

export class MatterManager extends SceneBound<GameLevel> {
  public matterTanks = new Map<MatterTankId, MatterTank>
  public playerMatterTank: MatterTank

  makePlayerMatterTank(
    player: MatterTankSource,
    matter = 0,
    matterMax = DEFAULT_PLAYER_MATTER_TANK_SIZE,
    tweenFrom = 0,
  ) {

    const data = this.scene.io.matterTankManager
    data.registerPlayerMatterTank(matterMax, matter)

    this.playerMatterTank = new MatterTank(
      this,
      data,
      player,
      PLAYER_MATTER_TANK_ID,
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
    const data = this.scene.io.matterTankManager

    const id = data.registerMatterTank(matterMax, matter)

    const tank = new MatterTank(
      this,
      data,
      source,
      id,
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

  playerReservedDestroy(): number {
    if (this.destroyed) return 0
    return this.playerMatterTank.reservedDestroy
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
