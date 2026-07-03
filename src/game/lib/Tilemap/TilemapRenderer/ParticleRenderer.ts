import { SceneBound } from '../../../helpers/SceneBound.ts'
import type { GameLevel } from '../../../scenes/GameLevel.ts'
import WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer
import WebGLTextureWrapper = Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper

export class ParticleRenderer extends SceneBound {
  readonly texture: Phaser.Textures.Texture
  private readonly textureWrapper: WebGLTextureWrapper

  constructor(public scene: GameLevel, readonly enabled: boolean) {
    super(scene)
    const { width, height } = scene.tilemap

    const [texture, wrapper] = this.scene.initGLTexture('particle_render_texture', width, height)
    this.texture = texture
    this.textureWrapper = wrapper
  }

  updateParticlePixels(buf: Uint8Array) {
    if (!this.enabled) return
    const { width, height } = this.scene.tilemap
    const gl = (this.scene.renderer as WebGLRenderer).gl
    gl.bindTexture(gl.TEXTURE_2D, this.textureWrapper.webGLTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  protected onDestroy() {
    if (this.texture.manager) {
      this.texture.destroy()
    }
  }
}
