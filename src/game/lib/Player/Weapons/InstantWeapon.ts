import { Scenes } from 'phaser'
import { FireMode } from '../../../config.ts'
import { FIRE_MODE_COLORS } from '../../../config/colors.ts'
import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import type { Position } from '../../../types.ts'
import { GameEvent } from '../../events.ts'
import { KeysetInput } from '../../Input/InputControllers/KeysetInput.ts'
import type { ImmediateWeapon } from '../../Input/InputControllers/WeaponManagerInput.ts'
import { WeaponSingleFireInput } from '../../Input/InputControllers/WeaponManagerInput/WeaponSingleFireInput.ts'
import { InstantProjectile } from '../../Projectiles/InstantProjectile.ts'
import { tilesToRadius } from '../../Projectiles/projectile-radius'
import { ProjectileRenderer } from '../../Projectiles/ProjectileRenderer.ts'
import { TerrainType, TerrainTypeValues } from '../../Tilemap/_Tilemap-types.ts'
import { EventsBinder } from '../../Util/EventsBinder.ts'
import { PlayerFireModeState } from '../PlayerFireModeState.ts'
import UPDATE = Scenes.Events.UPDATE

const MIN_CHARGE = 10
const COLLISION_TYPES = new Set(TerrainTypeValues.filter(v => v !== TerrainType.EMPTY))

export class InstantWeapon extends SceneBound implements ImmediateWeapon {
  readonly displayName = 'Instant'

  private fireInput: WeaponSingleFireInput
  private chargeInput: KeysetInput
  private renderer: ProjectileRenderer
  private _enabled: boolean

  private charge: number = -1

  private targetPos: Position
  private binder: EventsBinder
  private fireMode: PlayerFireModeState

  constructor(
    public scene: GameLevel,
    readonly slot: number,
  ) {
    super(scene)
    this.fireInput = new WeaponSingleFireInput(scene, this)
    this.fireMode = new PlayerFireModeState()
    this.chargeInput = new KeysetInput(scene, {
      'q': () => this.decreaseCharge(),
      'e': () => this.increaseCharge(),
      'r': () => {
        this.fireMode.prev()
        this.onFireModeChange()
      },
      'f': () => {
        this.fireMode.next()
        this.onFireModeChange()
      },
    })

    this.binder = new EventsBinder()
    this.binder.add(scene.events, UPDATE, this.update, this)

    this.renderer = new ProjectileRenderer(scene)
    this.renderer.setColor(FIRE_MODE_COLORS[this.fireMode.value()])
  }

  onFireModeChange(): void {
    this.renderer.setColor(FIRE_MODE_COLORS[this.fireMode.value()])
    this.scene.EVENTS.emit(GameEvent.UI_WEAPON_UPDATE, this)
  }

  fire(): void {
    const available = this.clampCharge()

    this.scene.projectiles.fireForPlayer(InstantProjectile, available, this.fireMode.value(), 0, this.targetPos, 0, null)
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
      this.binder.bind()
    } else {
      this.binder.unBind()
    }

    this._enabled = value
  }

  _playerArmPos: Position = { x: 0, y: 0 }

  update(): void {
    const armPosition = this.scene.player.getProjectilePosition(0, this._playerArmPos)
    const armAngle = this.scene.player.getProjectileAngle()
    this.targetPos = this.scene.tilemap.getAngleCollision(armPosition.x, armPosition.y, armAngle, COLLISION_TYPES)

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
    return ` | charge: ${this.charge}, radius: ${Math.round(this.renderer.radius)} Q/E keys change charge | Mode: ${FireMode[this.fireMode.value()]} R/F keys change mode`
  }

  protected setCharge(val: number): boolean {
    val = Math.max(MIN_CHARGE, val)
    const mode = this.fireMode.value()
    const charge = this.scene.player.matterTank.clampToChargeAvailable(val, mode)
    if (charge === this.charge) return false
    this.charge = charge
    const radius = tilesToRadius(charge)
    this.renderer.setRadius(radius)

    this.scene.EVENTS.emit(GameEvent.UI_WEAPON_UPDATE, this)

    return true
  }

  protected clampCharge() {
    this.setCharge(this.charge)
    return this.charge
  }

  protected onDestroy() {
    this.setEnabled(false)
    this.fireInput.destroy()

    // @ts-expect-error: destroy
    this.renderer = null
    // @ts-expect-error: destroy
    this.fireInput = null
    // @ts-expect-error: destroy
    this.chargeInput = null
  }
}