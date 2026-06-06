import { BlendModes, Display, GameObjects } from 'phaser'
import { DRAW_PARTICLE_DEBUG, MAX_MATTER_PARTICLES } from '../../config.ts'
import { CREATE_COLOR_RGB, DESTROY_COLOR_RGB } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { Position } from '../../types.ts'
import { PARTICLE_SIZE, VFXMatterParticle } from './VFXMatterParticle.ts'
import Color = Display.Color
import Graphics = GameObjects.Graphics
import ParticleEmitter = GameObjects.Particles.ParticleEmitter

export class VFXParticleManager extends SceneBound {
  public emitter: ParticleEmitter
  debugGraphics: Graphics | null = null

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
      particleClass: VFXMatterParticle,
      speed: 0,
      quantity: Math.min(1000, MAX_MATTER_PARTICLES),
      // manual
      frequency: -1,
      maxAliveParticles: MAX_MATTER_PARTICLES,
      emitting: false,
      blendMode: BlendModes.ADD,
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
    if (MAX_MATTER_PARTICLES <= 0) return
    const particle = this.emitter.emitParticleAt(source.x, source.y, 1) as VFXMatterParticle
    particle?.init(target, staticTarget, colorFrom, colorTo)
  }

  protected onDestroy() {
    this.debugGraphics = null
    // @ts-expect-error: destroy
    this.emitter = null
  }
}

class MatterParticleEmitter extends ParticleEmitter {
  preUpdate(time: number, delta: number) {
    if (DRAW_PARTICLE_DEBUG) {
      (this.scene as GameLevel).vfxParticleManager?.debugGraphics?.clear()
    }
    super.preUpdate(time, delta)
  }
}