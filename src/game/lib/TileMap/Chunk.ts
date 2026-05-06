export class Chunk {
  public collisionDirty = true
  public renderDirty = true
  public isEmpty: boolean = true

  constructor(
    readonly id: number,
    readonly cx: number,
    readonly cy: number,
  ) {
  }

  setDirty() {
    this.renderDirty = true
    this.collisionDirty = true
  }
}