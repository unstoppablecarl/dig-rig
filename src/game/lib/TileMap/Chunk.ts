export class Chunk {
  public collisionDirty = true
  public renderDirty = true
  public isEmpty: boolean = true

  constructor(
    public readonly cx: number,
    public readonly cy: number,
  ) {
  }

  setDirty() {
    this.renderDirty = true
    this.collisionDirty = true
  }
}