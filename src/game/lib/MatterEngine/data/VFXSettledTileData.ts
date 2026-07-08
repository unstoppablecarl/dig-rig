import { ringBufferByteLength, RingBufferReader, RingBufferWriter } from '../../Util/RingBuffer.ts'

const SCHEMA = {
  tileXY: Uint32Array,   // x<<16 | y
  matterType: Uint32Array,
}

export type VFXSettledTilesBuffer = {
  tiles: SharedArrayBuffer,
  capacity: number,
}

export class VFXSettledTileData {
  private readonly writer: RingBufferWriter<typeof SCHEMA>
  private readonly reader: RingBufferReader<typeof SCHEMA>

  static makeBuffer(width: number, height: number): VFXSettledTilesBuffer {
    const tileCount = width * height
    const capacity = Math.floor(tileCount * 0.25)

    const BYTE_LENGTH = ringBufferByteLength(SCHEMA, capacity)

    return {
      tiles: new SharedArrayBuffer(BYTE_LENGTH),
      capacity,
    }
  }

  constructor({ tiles, capacity }: VFXSettledTilesBuffer) {
    this.writer = new RingBufferWriter(SCHEMA, capacity, tiles)
    this.reader = new RingBufferReader(SCHEMA, capacity, tiles)
  }

  // Coordinator side — sole writer of writeHead.
  writeTile(tx: number, ty: number, matterType: number) {
    this.writer.write((cursor) => {
      cursor.tileXY = (tx << 16) | (ty & 0xffff)
      cursor.matterType = matterType
    })
  }

  // Main thread side — sole writer of readHead.
  drain(callback: (tileX: number, tileY: number, matterType: number) => void) {
    this.reader.drain((cursor) => {
      callback(cursor.tileXY >>> 16, cursor.tileXY & 0xffff, cursor.matterType)
    })
  }
}
