import type { Scene } from 'phaser'
import { watch, type WatchHandle } from 'vue'
import { matterMeterState } from '../../../store/matterMeterState.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { FireGroupWeapon, Weapon } from '../Input/InputController/WeaponManagerInput.ts'
import type { MatterTank } from '../Matter/Tank/MatterTank.ts'
import { FireGroup, FireMode } from '../Player/_FireMode-types'

const MATTER_FILL_SMOOTH_RATE = 10
const MATTER_FILL_SNAP_EPSILON = 0.0008
const ANIMATE_MATTER_FILL = true

export class MatterMeter extends SceneBound {
  private matterTank: MatterTank
  private unwatchTank: WatchHandle
  private smoothedFill = 0

  constructor(
    public scene: Scene,
    public gameLevel: GameLevel,
  ) {
    super(scene)

    this.unwatchTank = watch(
      () => gameLevel.weaponUIState.activeMatterTank,
      (tank) => {
        if (tank) {
          this.setMatterTank(tank as MatterTank)
          matterMeterState.visible.value = true
        } else {
          matterMeterState.visible.value = false
        }
      },
      { immediate: true },
    )
  }

  update(delta: number) {
    const matterTank = this.matterTank
    if (!matterTank) return

    const target = matterTank.percent()
    if (ANIMATE_MATTER_FILL) {
      const distance = target - this.smoothedFill
      if (Math.abs(distance) < MATTER_FILL_SNAP_EPSILON) {
        this.smoothedFill = target
      } else {
        this.smoothedFill += distance * (1 - Math.exp(-MATTER_FILL_SMOOTH_RATE * (delta / 1000)))
      }
    } else {
      this.smoothedFill = target
    }

    const fill = this.smoothedFill
    matterMeterState.fillPercent.value = fill

    const matterText = Math.floor(matterTank.matterContained())
    matterMeterState.matterText.value = matterText === 0 ? '' : matterText.toString()

    matterMeterState.reservedDestroyPercent.value = matterTank.getReservedDestroyPercent()
    matterMeterState.pendingDestroyPercent.value = matterTank.getPendingChargePercent(FireMode.DESTROY)
    matterMeterState.pendingCreatePercent.value = matterTank.getPendingChargePercent(FireMode.CREATE)

    const weapon = this.gameLevel.playerWeaponManager.activeWeapon() as Weapon | FireGroupWeapon
    if ('getFireGroup' in weapon && weapon.getFireGroup() === FireGroup.CREATE_DESTROY) {
      const destroyPercent = Math.min(1, weapon.getCharge() / matterTank.chargeAvailable(FireMode.DESTROY))
      matterMeterState.destroyChargePercent.value = destroyPercent * matterTank.getChargeAvailablePercent(FireMode.DESTROY)

      const createPercent = Math.min(1, weapon.getCharge() / matterTank.chargeAvailable(FireMode.CREATE))
      matterMeterState.createChargePercent.value = createPercent * matterTank.getChargeAvailablePercent(FireMode.CREATE)
    } else {
      matterMeterState.destroyChargePercent.value = 0
      matterMeterState.createChargePercent.value = 0
    }
  }

  setMatterTank(matterTank: MatterTank): void {
    this.matterTank = matterTank
    this.smoothedFill = matterTank.percent()
  }

  protected onDestroy() {
    this.unwatchTank()
    matterMeterState.visible.value = false
    // @ts-expect-error: destroy
    this.gameLevel = null
  }
}
