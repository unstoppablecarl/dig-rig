import type { BodyType } from 'matter'
import { Animations, GameObjects, Math as PMath, Physics, Time } from 'phaser'
import type { EventData } from 'phaser-matter-collision-plugin/src/collision-types.ts'
import { CollidingObject } from 'phaser-matter-collision-plugin/src/valid-collision-object.ts'
import { GRAVITY, PLAYER_JUMP_POWER, PLAYER_MATTER_TANK_SIZE, PLAYER_MOVE_SPEED } from '../../config.ts'
import { clampVelocity, PositionOffset } from '../../helpers/_helpers.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { MatterExchanger, ParticleTarget, Position } from '../../types.ts'
import { MASK_PLAYER, MASK_TERRAIN } from '../Collision/BodyCategories.ts'
import { MatterTank } from '../Matter/MatterTank.ts'
import { makePlayerInput, type PlayerInput } from './InputKeys.ts'
import Animation = Animations.Animation
import AnimationFrame = Animations.AnimationFrame
import Container = GameObjects.Container
import Sprite = GameObjects.Sprite
import AFTER_UPDATE = Physics.Matter.Events.AFTER_UPDATE
import BEFORE_UPDATE = Physics.Matter.Events.BEFORE_UPDATE
import Image = Physics.Matter.Image

const PLAYER_WIDTH = 18
const PLAYER_HEIGHT = 30

const PLAYER_BODY_CONFIG = {
  frictionStatic: 0,
  frictionAir: 0,
  friction: 0,
  mass: 0.0001,
}
const PLAYER_PROJECTILE_ORIGIN_X = 18
const PLAYER_PROJECTILE_ORIGIN_Y = 3

const ARM_OFFSET = {
  x: -4,
  y: 3,
}
const ARM_ORIGIN = {
  x: 1 / 18,
  y: 4 / 8,
}

const DEBUG_DRAW_COLLECT_OFFSET = false

enum Facing {
  LEFT,
  RIGHT
}

export class Player extends SceneBound implements MatterExchanger, ParticleTarget {
  public input: PlayerInput
  public sprite: Sprite
  public container: PlayerContainer
  public maxVelocity = 300
  public matterTank: MatterTank
  public isTouching = {
    left: false,
    right: false,
    ground: false,
  }
  public prevPosition = {
    x: 0,
    y: 0,
  }
  public x = 0
  public y = 0
  private arm: Sprite
  private facing: Facing = Facing.RIGHT
  private armMove = false
  private backpackOffset = new PositionOffset(this, -6, -7)
  private sensors: { bottom: PlayerBodySensor, left: PlayerBodySensor, right: PlayerBodySensor }
  private canJump = true
  private jumpCooldownTimer: Time.TimerEvent

  constructor(
    public scene: GameLevel,
    x = 0,
    y = 0,
  ) {
    super(scene)

    this.matterTank = scene.matterManager.makePlayerMatterTank(
      PLAYER_MATTER_TANK_SIZE,
      400,
      500,
    )

    this.initCollisionBody()
    this.initSprite()
    this.setPosition(x, y)
    this.input = makePlayerInput(scene)

    // collision debugger
    // this.scene.matter.world.on('collisionstart', (event, bodyA, bodyB) => {
    //   console.log('COLLISION EVENT - current vx:', this.container.body.velocity.x)
    //
    //   // console.log({ a: bodyA, b: bodyB })
    //
    //   let playerBody
    //   let playerSensorBody
    //   let otherBody
    //   if (bodyA.isPlayerBody) {
    //     playerBody = bodyA
    //     otherBody = bodyB
    //   }
    //   if (bodyB.isPlayerBody) {
    //     playerBody = bodyB
    //     otherBody = bodyA
    //   }
    //   if (bodyA.isPlayerBodySensor) {
    //     playerSensorBody = bodyA
    //     otherBody = bodyB
    //   }
    //   if (bodyB.isPlayerBodySensor) {
    //     playerSensorBody = bodyB
    //     otherBody = bodyA
    //   }
    //   if (playerBody) {
    //     console.log('player body')
    //     // console.log(event, otherBody)
    //   }
    //   if (playerSensorBody) {
    //     console.log('player sensor body')
    //     // console.log(event, otherBody)
    //   }
    //
    // })
  }

  setPosition(x: number, y: number) {
    this.x = this.container.x = x
    this.y = this.container.y = y
  }

  matterParticleCollectPosition(): Position {
    return this.backpackOffset
  }

  matterParticleEmitPosition(out: Position): Position {
    return this.getProjectilePosition(0, out)
  }

  private initCollisionBody() {
    const scene = this.scene
    const w = PLAYER_WIDTH
    const h = PLAYER_HEIGHT

    const gap = 0.05
    const bodyWidthPercent = 0.6
    const bodyWidth = w * bodyWidthPercent
    const sideSensorWidthPercent = 1 - bodyWidthPercent - gap
    const sideSensorWidth = w * sideSensorWidthPercent

    this.sensors = {
      bottom: scene.matter.bodies.rectangle(0, h * 0.5, w * 0.5, 2, {
        isSensor: true,
        label: 'player_bottom_sensor',
      }) as PlayerBodySensor,
      left: scene.matter.bodies.rectangle(-sideSensorWidth, 0, 2, h * 0.8, {
        isSensor: true,
        label: 'player_left_sensor',
      }) as PlayerBodySensor,
      right: scene.matter.bodies.rectangle(sideSensorWidth, 0, 2, h * 0.8, {
        isSensor: true,
        label: 'player_right_sensor',
      }) as PlayerBodySensor,
    }

    this.sensors.bottom.isPlayerBodySensor = true
    this.sensors.left.isPlayerBodySensor = true
    this.sensors.right.isPlayerBodySensor = true

    const mainBody = scene.matter.bodies.rectangle(0, 0, bodyWidth, h, {
      label: 'player_main',
      collisionFilter: {
        category: MASK_PLAYER,
        mask: MASK_TERRAIN,
      },
      chamfer: { radius: 5 },
    }) as PlayerBody

    mainBody.isPlayerBody = true

    this.container = scene.matter.add.gameObject(this.scene.add.container(this.x, this.y), {
      parts: [
        mainBody,
        this.sensors.bottom,
        this.sensors.left,
        this.sensors.right,
      ],
      ...PLAYER_BODY_CONFIG,
      render: { sprite: { xOffset: 0.5, yOffset: 0.5 } },
    }) as unknown as Image & Sprite & Container

    this.scene.layers.player.add(this.container)

    this.container.setFixedRotation()

    scene.matter.world.on(BEFORE_UPDATE, this.resetTouching, this)
    scene.matter.world.on(AFTER_UPDATE, this.updateArm, this)

    const collideConfig = {
      objectA: Object.values(this.sensors),
      callback: this.onSensorCollide,
      context: this,
    }
    scene.matterCollision.addOnCollideStart(collideConfig)
    scene.matterCollision.addOnCollideActive(collideConfig)
  }

  private initSprite() {

    this.sprite = this.scene.add.sprite(0, 0, 'player')

    this.sprite.anims.create({
      key: 'idle',
      frames: this.scene.anims.generateFrameNumbers('player', { frames: [0] }),
      frameRate: 8,
      repeat: -1,
    })

    const walkFrames = [0, 1, 2, 3, 4, 5]
    this.sprite.anims.create({
      key: 'walk',
      frames: this.scene.anims.generateFrameNumbers('player', { frames: walkFrames }),
      frameRate: 14,
      repeat: -1,
    })

    this.sprite.anims.create({
      key: 'walk-reverse',
      frames: this.scene.anims.generateFrameNumbers('player', { frames: walkFrames.reverse() }),
      frameRate: 14,
      repeat: -1,
    })

    this.sprite.anims.create({
      key: 'hurt',
      frames: this.scene.anims.generateFrameNumbers('player', { frames: [12, 13] }),
      frameRate: 2,
      repeat: -1,
    })

    this.sprite.anims.create({
      key: 'fall',
      frames: this.scene.anims.generateFrameNumbers('player', { frames: [7] }),
    })

    this.sprite.anims.create({
      key: 'jump',
      frames: this.scene.anims.generateFrameNumbers('player', { frames: [6] }),
    })

    this.sprite.play('idle')
    this.container.add(this.sprite)

    this.arm = this.scene.add.sprite(ARM_OFFSET.x, ARM_OFFSET.y, 'player-arm')
    this.arm.setOrigin(ARM_ORIGIN.x, ARM_ORIGIN.y)
    this.container.add(this.arm)

    this.sprite.on(Animations.Events.ANIMATION_UPDATE, (anim: Animation, frame: AnimationFrame) => {
      const newValue = (anim.key === 'walk') && (frame.index === 1 || frame.index === 2 || frame.index === 3)
      if (newValue !== this.armMove) {
        this.armMove = newValue
        this.updateArmPosition()
      }
    })

    if (DEBUG_DRAW_COLLECT_OFFSET) {
      const off = this.backpackOffset.getOffset()
      const rect = this.scene.add.rectangle(off.x, off.y, 2, 2, 0xff0000)
      this.container.add(rect)
    }
  }

  onSensorCollide({ bodyA, bodyB, pair }: EventData<BodyType, CollidingObject>) {
    // type info isn't completely correct in the plugin
    // probably just out of date
    const separation = (pair as any).separation as unknown as number
    // Watch for the player colliding with walls/objects on either side and the ground below, so
    // that we can use that logic in update() to move the player.
    // Note: we are using the "pair.separation" here. That number tells us how much bodyA and bodyB
    // overlap. We want to teleport the sprite away from walls just enough so that the player won't
    // be able to press up against the wall and use friction to hang in midair. This formula leaves
    // 0.5px of overlap with the sensor so that the sensor will stay colliding on the next tick if
    // the player doesn't move.
    if (bodyB.isSensor) return
    if (bodyA === this.sensors.left) {
      this.isTouching.left = true
      if (separation > 0.5) this.container.x += separation - 0.5
    } else if (bodyA === this.sensors.right) {
      this.isTouching.right = true
      if (separation > 0.5) this.container.x -= separation - 0.5
    } else if (bodyA === this.sensors.bottom) {
      this.isTouching.ground = true
    }
  }

  resetTouching() {
    this.isTouching.left = false
    this.isTouching.right = false
    this.isTouching.ground = false
  }

  private setFacingLeft() {
    this.setFacing(Facing.LEFT)
  }

  private setFacingRight() {
    this.setFacing(Facing.RIGHT)
  }

  private updateArmPosition() {
    this.setFacing(this.facing)
  }

  private setFacing(facing: Facing) {
    let offsetX = ARM_OFFSET.x
    let originX = ARM_ORIGIN.x
    if (this.armMove) {
      offsetX -= 1
    }
    this.facing = facing
    const flip = facing === Facing.LEFT
    if (flip) {
      offsetX *= -1
      originX = 1 - originX
    }
    this.sprite.setFlipX(flip)
    this.arm.setFlipX(flip)
    this.arm.setPosition(offsetX, ARM_OFFSET.y)
    this.arm.setOrigin(originX, ARM_ORIGIN.y)
    this.backpackOffset.flipX = facing === Facing.LEFT
  }

  public getProjectilePosition(offset: number = 0, out: Position) {
    let x = PLAYER_PROJECTILE_ORIGIN_X + offset
    if (this.facing === Facing.LEFT) {
      x *= -1
    }

    return this.arm.getWorldTransformMatrix().transformPoint(x, -PLAYER_PROJECTILE_ORIGIN_Y, out)
  }

  public getInverseProjectilePosition(offset: number = 0, out: Position) {
    let x = -(PLAYER_PROJECTILE_ORIGIN_X + offset)
    if (this.facing === Facing.LEFT) {
      x *= -1
    }

    return this.arm.getWorldTransformMatrix().transformPoint(x, PLAYER_PROJECTILE_ORIGIN_Y, out)
  }

  public getProjectileAngle() {
    let angle = this.arm.rotation

    if (this.facing === Facing.LEFT) {
      angle += Math.PI
    }
    return angle
  }

  public update() {
    this.updateFacing()
    this.updatePosition()
  }

  private updatePosition() {
    this.prevPosition.x = this.x
    this.prevPosition.y = this.y

    const left = this.input.left.isDown()
    const right = this.input.right.isDown()
    const jumping = this.input.jump.isDown()
    const down = this.input.down.isDown()

    const isOnGround = this.isTouching.ground
    const isInAir = !isOnGround
    const container = this.container
    const body = this.container.body as BodyType
    const move = PLAYER_MOVE_SPEED * 0.1

    // debug zero-g mode
    if (GRAVITY === 0) {
      if (left) container.setVelocityX(-PLAYER_MOVE_SPEED)
      if (right) container.setVelocityX(PLAYER_MOVE_SPEED)

      if (jumping) container.setVelocityY(-PLAYER_MOVE_SPEED)
      if (down) container.setVelocityY(PLAYER_MOVE_SPEED)
    } else {

      let vx = body.velocity.x

      // prevent player pushing things if in the air
      if (left) {
        if (!(isInAir && this.isTouching.left)) {
          vx -= move
        }
      } else if (right) {
        if (!(isInAir && this.isTouching.right)) {
          vx += move
        }
      } else {
        vx = 0
      }
      vx = PMath.Clamp(vx, -PLAYER_MOVE_SPEED, PLAYER_MOVE_SPEED)

      container.setVelocityX(vx)

      if (jumping && this.canJump && isOnGround) {
        container.setVelocityY(PLAYER_JUMP_POWER)

        // add a slight delay between jumps
        // bottom sensor will still collide for a few
        // frames after a jump is initiated
        this.canJump = false
        this.jumpCooldownTimer = this.scene.time.addEvent({
          delay: 250,
          callback: () => this.canJump = true,
        })
      }

      clampVelocity(this.container, this.maxVelocity)
    }
    this.x = this.container.x
    this.y = this.container.y
  }

  private updateFacing() {
    const activePointer = this.scene.input.activePointer
    const mousePos = this.scene.cameras.main.getWorldPoint(
      activePointer.x,
      activePointer.y,
    )

    const mouseLeftOfPlayer = mousePos.x < this.x
    const mouseRightOfPlayer = !mouseLeftOfPlayer
    const body = this.container.body as BodyType

    const vx = body.velocity.x
    const vy = body.velocity.y

    const threshold = 0.1
    const movingLeft = vx < -threshold
    const movingRight = vx > threshold
    if (this.isTouching.ground) {
      if (movingLeft) {
        if (mouseRightOfPlayer) {
          this.sprite.play('walk-reverse', true)
        } else {
          this.sprite.play('walk', true)
        }
      } else if (movingRight) {
        if (mouseLeftOfPlayer) {
          this.sprite.play('walk-reverse', true)
        } else {
          this.sprite.play('walk', true)
        }
      } else {
        this.sprite.play('idle', true)
      }
    } else {
      if (vy < 0) {
        this.sprite.play('jump', true)
      } else if (vy > 0) {
        this.sprite.play('fall', true)
      } else {
        this.sprite.play('idle', true)
      }
    }

    if (mouseLeftOfPlayer) {
      this.setFacingLeft()
    } else {
      this.setFacingRight()
    }
  }

  private updateArm() {
    const cam = this.scene.cameras.main
    const activePointer = this.scene.input.activePointer
    const mousePos = cam.getWorldPoint(activePointer.x, activePointer.y)

    this.arm.rotation = PMath.Angle.Between(
      this.container.x + this.arm.x,
      this.container.y + this.arm.y,
      mousePos.x,
      mousePos.y,
    )

    if (this.facing === Facing.LEFT) {
      this.arm.rotation += Math.PI
    }
  }

  onDestroy() {
    this.scene.matter.world?.off(BEFORE_UPDATE, this.resetTouching, this)
    this.scene.matter.world?.off(AFTER_UPDATE, this.updateArm, this)
    const sensors = [this.sensors.bottom, this.sensors.left, this.sensors.right]
    this.scene.matterCollision.removeOnCollideStart({ objectA: sensors })
    this.scene.matterCollision.removeOnCollideActive({ objectA: sensors })
    if (this.jumpCooldownTimer) this.jumpCooldownTimer.destroy()

    this.sprite.destroy()
    this.container.destroy()
    this.arm.destroy()
    this.matterTank.destroy()

    // @ts-expect-error: destroy
    this.input = null
    // @ts-expect-error: destroy
    this.sprite = null
    // @ts-expect-error: destroy
    this.container = null
    // @ts-expect-error: destroy
    this.matterTank = null
    // @ts-expect-error: destroy
    this.prevPosition = null
    // @ts-expect-error: destroy
    this.arm = null
    // @ts-expect-error: destroy
    this.backpackOffset = null
    // @ts-expect-error: destroy
    this.sensors = null
    // @ts-expect-error: destroy
    this.isTouching = null
    // @ts-expect-error: destroy
    this.jumpCooldownTimer = null
  }
}

// fixing phaser ts limitations
export type PlayerContainer = GameObjects.Container &
  Physics.Matter.Components.Bounce &
  Physics.Matter.Components.Collision &
  Physics.Matter.Components.Force &
  Physics.Matter.Components.Friction &
  Physics.Matter.Components.Gravity &
  Physics.Matter.Components.Mass &
  Physics.Matter.Components.Sensor &
  Physics.Matter.Components.SetBody &
  Physics.Matter.Components.Sleep &
  Physics.Matter.Components.Static &
  Physics.Matter.Components.Transform &
  Physics.Matter.Components.Velocity

type PlayerBodySensor = MatterJS.BodyType & { isPlayerBodySensor: true }
type PlayerBody = MatterJS.BodyType & { isPlayerBody: true }