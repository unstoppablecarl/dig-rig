import { Scenes } from 'phaser'
import { FireMode, PROJECTILE_MODE_COLORS } from '../../../config.ts'
import { isMatterTankFireMode } from '../../../helpers/_helpers.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { GameEvent } from '../../events.ts'
import { PlayerKeyset } from '../../Input/PlayerKeyset.ts'
import { PlayerWeaponSingleFireInput } from '../../Input/PlayerWeaponSingleFireInput.ts'
import { InstantProjectile } from '../../Projectiles/InstantProjectile.ts'
import { tilesToRadius } from '../../Projectiles/projectile-radius'
import { ProjectileRenderer } from '../../Projectiles/ProjectileRenderer.ts'
import { TerrainType } from '../../Tilemap/_Tilemap-types.ts'
import type { ImmediateWeapon } from './PlayerWeaponManager.ts'
import UPDATE = Scenes.Events.UPDATE

const MIN_CHARGE = 10

export abstract class InstantWeapon extends SceneBound implements ImmediateWeapon {
  readonly abstract displayName: string

  private fireInput: PlayerWeaponSingleFireInput
  private chargeInput: PlayerKeyset
  private renderer: ProjectileRenderer
  private _enabled: boolean

  private charge: number = -1

  private targetPos: Position

  constructor(
    public scene: GameLevel,
    readonly slot: number,
    protected mode: FireMode,
  ) {
    super(scene)
    this.fireInput = new PlayerWeaponSingleFireInput(scene, this)
    this.chargeInput = new PlayerKeyset(scene, {
      'q': () => this.decreaseCharge(),
      'e': () => this.increaseCharge(),
    })

    this.renderer = new ProjectileRenderer(scene)
    this.renderer.setColor(PROJECTILE_MODE_COLORS[this.mode])
  }

  fire(): void {
    const available = this.clampCharge()

    this.scene.projectiles.fireForPlayer(InstantProjectile, available, this.mode, 0, this.targetPos, 0, null)
  }

  get enabled() {
    return this._enabled
  }

  setEnabled(value: boolean) {
    if (this._enabled === value) return
    this.fireInput.setInputEnabled(value)
    this.chargeInput.setInputEnabled(value)
    this.renderer.setVisible(value)

    if (value) {
      this.setCharge(2000)
      this.scene.events.on(UPDATE, this.update, this)
    } else {
      this.scene.events.off(UPDATE, this.update, this)
    }

    this._enabled = value
  }

  _playerArmPos: Position = { x: 0, y: 0 }

  update(): void {
    const armPosition = this.scene.player.getProjectilePosition(0, this._playerArmPos)
    const armAngle = this.scene.player.getProjectileAngle()
    this.targetPos = this.scene.tilemap.getAngleCollision(armPosition.x, armPosition.y, armAngle, new Set([TerrainType.SOLID]))
    this.renderer.setPosition(this.targetPos)
    this.clampCharge()
  }

  increaseCharge(): void {
    const changed = this.setCharge(this.charge + 100)
    if (!changed) {
      this.scene.EVENTS.emit(GameEvent.MESSAGE, 'Max Available in Matter Tank')
    }
  }

  decreaseCharge(): void {
    this.setCharge(this.charge - 100)
  }

  getSuffix(): string {
    return ` charge: ${this.charge}, radius: ${Math.round(this.renderer.radius)} Q/E keys change charge`
  }

  protected setCharge(val: number): boolean {
    val = Math.max(MIN_CHARGE, val)
    let charge = val
    if (isMatterTankFireMode(this.mode)) {
      charge = this.scene.player.matterTank.clampToChargeAvailable(val, this.mode)
    }
    if (charge === this.charge) return false
    this.charge = charge
    const radius = tilesToRadius(charge)
    this.renderer.setRadius(radius)
    return true
  }

  protected clampCharge() {
    this.setCharge(this.charge)
    return this.charge
  }

  protected onDestroy() {
    this.setEnabled(false)
    this.fireInput.destroy()
  }
}