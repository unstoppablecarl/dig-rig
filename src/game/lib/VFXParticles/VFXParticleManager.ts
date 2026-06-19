import { BlendModes, Display, GameObjects } from 'phaser'
import { DRAW_PARTICLE_DEBUG, MAX_MATTER_PARTICLES, VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE } from '../../config.ts'
import { CREATE_COLOR, DESTROY_COLOR } from '../../config/colors.ts'
import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import type { ParticleTarget, Position } from '../../types.ts'
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

  spawnMatter(source: Position, target: Position, staticTarget: true): void
  spawnMatter(source: Position, target: ParticleTarget, staticTarget: false): void
  spawnMatter(
    source: Position,
    target: Position | ParticleTarget,
    staticTarget: boolean,
  ) {
    this.spawn(source, target as Position, staticTarget as true, DESTROY_COLOR, CREATE_COLOR)
  }

  // One particle per chunk: source is fixed, targets are tile positions.
  spawnMatterToTiles(source: Position, tiles: ReadonlyArray<Position>) {
    if (MAX_MATTER_PARTICLES <= 0) return
    const seen = new Set<number>()
    for (const tile of tiles) {
      const cx = Math.floor(tile.x / VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE)
      const cy = Math.floor(tile.y / VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE)
      const key = (cy << 11) | cx
      if (seen.has(key)) continue
      seen.add(key)
      this.spawn(source, {
        x: (cx + 0.5) * VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE,
        y: (cy + 0.5) * VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE,
      }, true, DESTROY_COLOR, CREATE_COLOR)
    }
  }

  // One particle per chunk: sources are tile positions, target is a live entity.
  spawnMatterFromTiles(tiles: ReadonlyArray<Position>, target: ParticleTarget) {
    if (MAX_MATTER_PARTICLES <= 0) return
    const seen = new Set<number>()
    for (const tile of tiles) {
      const cx = Math.floor(tile.x / VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE)
      const cy = Math.floor(tile.y / VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE)
      const key = (cy << 11) | cx
      if (seen.has(key)) continue
      seen.add(key)
      this.spawn({
        x: (cx + 0.5) * VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE,
        y: (cy + 0.5) * VFX_PARTICLE_TO_TERRAIN_CHUNK_SIZE,
      }, target, false, DESTROY_COLOR, CREATE_COLOR)
    }
  }

  spawnMatterTankTransfer(amount: number, source: Position, target: ParticleTarget) {
    if (MAX_MATTER_PARTICLES <= 0) return
    const count = Math.max(Math.floor(amount / 10), 1)
    for (let i = 0; i < count; i++) {
      this.spawn(source, target, false, CREATE_COLOR, CREATE_COLOR)
    }
  }

  spawn(source: Position, target: Position, staticTarget: true, colorFrom: Color, colorTo: Color): void
  spawn(source: Position, target: ParticleTarget, staticTarget: false, colorFrom: Color, colorTo: Color): void
  spawn(
    source: Position,
    target: Position | ParticleTarget,
    staticTarget: boolean,
    colorFrom: Color,
    colorTo: Color,
  ) {
    if (MAX_MATTER_PARTICLES <= 0) return
    const particle = this.emitter.emitParticleAt(source.x, source.y, 1) as VFXMatterParticle
    particle?.init(target as Position, staticTarget as true, colorFrom, colorTo)
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