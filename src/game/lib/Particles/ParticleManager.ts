import type { GameLevel } from '../../scenes/GameLevel.ts'
import { MatterParticle, PARTICLE_SIZE } from './MatterParticle.ts'
import type { Position } from '../../types.ts'
import { CREATE_COLOR_RGB, DESTROY_COLOR_RGB, DRAW_PARTICLE_DEBUG, MAX_MATTER_PARTICLES } from '../../config.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import ParticleEmitter = Phaser.GameObjects.Particles.ParticleEmitter
import Color = Phaser.Display.Color
import Graphics = Phaser.GameObjects.Graphics

export class ParticleManager extends SceneBound {
  public emitter: ParticleEmitter
  declare debugGraphics: Graphics | null

  public constructor(public scene: GameLevel) {
    super(scene)
    if (DRAW_PARTICLE_DEBUG) {
      this.debugGraphics = this.scene.add.graphics({
        lineStyle: {
          width: 0.25,
          color: 0x00ff00,
          alpha: 0.01,
        },
      })
    }

    const graphics = this.scene.make.graphics()
    graphics.fillStyle(0xffffff)
    graphics.fillCircle(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE)
    graphics.generateTexture('particle', PARTICLE_SIZE * 2, PARTICLE_SIZE * 2)
    graphics.destroy()

    let EmitterClass = ParticleEmitter
    if (DRAW_PARTICLE_DEBUG) {
      EmitterClass = MatterParticleEmitter
    }

    this.emitter = this.scene.sys.displayList.add(new EmitterClass(this.scene, 0, 0, 'particle', {
      particleClass: MatterParticle,
      speed: 0,
      quantity: 1000,
      // manual
      frequency: -1,
      maxAliveParticles: MAX_MATTER_PARTICLES,
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    }))
  }

  spawnMatter(
    source: Position,
    target: Position,
    staticTarget: boolean,
  ) {
    this.spawn(source, target, staticTarget, DESTROY_COLOR_RGB, CREATE_COLOR_RGB)
  }

  spawn(
    source: Position,
    target: Position,
    staticTarget: boolean,
    colorFrom: Color,
    colorTo: Color,
  ) {
    const particle = this.emitter.emitParticleAt(source.x, source.y, 1) as MatterParticle

    if (!particle) {
      console.warn('not getting particles')
    }

    particle?.init(target, staticTarget, colorFrom, colorTo)
  }

  destroy() {
    super.destroy()

    this.debugGraphics = null
    // @ts-expect-error: destroy
    this.emitter = null
  }
}

class MatterParticleEmitter extends ParticleEmitter {
  preUpdate(time: number, delta: number) {
    if (DRAW_PARTICLE_DEBUG) {
      (this.scene as GameLevel).particleManager?.debugGraphics?.clear()
    }
    super.preUpdate(time, delta)
  }
}