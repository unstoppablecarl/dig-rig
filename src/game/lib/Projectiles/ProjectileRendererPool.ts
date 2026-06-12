import { SceneBound } from '../../helpers/SceneBound.ts'
import type { GameLevel } from '../../scenes/GameLevel.ts'
import { ProjectileRenderer } from './ProjectileRenderer.ts'

export class ProjectileRendererPool extends SceneBound {
  private available: ProjectileRenderer[] = []
  private all = new Set<ProjectileRenderer>()

  constructor(readonly scene: GameLevel) {
    super(scene)
  }

  acquire(): ProjectileRenderer {
    const r = this.available.pop() ?? this._create()
    r._inPool = false
    return r
  }

  release(renderer: ProjectileRenderer): void {
    renderer.reset()
    this.available.push(renderer)
  }

  private _create(): ProjectileRenderer {
    const r = new ProjectileRenderer(this.scene, this)
    r.reset()
    this.all.add(r)
    return r
  }

  protected onDestroy(): void {
    for (const r of this.all) {
      if (!r.destroyed) r.destroy()
    }
    this.available = []
    this.all.clear()
  }
}
