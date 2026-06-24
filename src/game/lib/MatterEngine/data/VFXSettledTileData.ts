import { ringBufferByteLength, RingBufferReader, RingBufferWriter } from '../../Util/RingBuffer.ts'

const CAPACITY = 2048

const SCHEMA = {
  tileXY: Uint32Array,   // x<<16 | y
  matterType: Uint32Array,
}

const BYTE_LENGTH = ringBufferByteLength(SCHEMA, CAPACITY)

export class VFXSettledTileData {
  private readonly writer: RingBufferWriter<typeof SCHEMA>
  private readonly reader: RingBufferReader<typeof SCHEMA>

  static makeBuffer(): SharedArrayBuffer {
    return new SharedArrayBuffer(BYTE_LENGTH)
  }

  constructor(readonly buffer: SharedArrayBuffer) {
    this.writer = new RingBufferWriter(SCHEMA, CAPACITY, buffer)
    this.reader = new RingBufferReader(SCHEMA, CAPACITY, buffer)
  }

  // Coordinator side — sole writer of writeHead.
  writeTile(tx: number, ty: number, matterType: number) {
    this.writer.write((cursor) => {
      cursor.tileXY = (tx << 16) | (ty & 0xffff)
      cursor.matterType = matterType
    })
  }

  writeTilesToTank(tiles: ReadonlyArray<{ x: number; y: number }>, matterType: number) {
    this.writer.writeMany(tiles, (cursor, tile) => {
      cursor.tileXY = (tile.x << 16) | (tile.y & 0xffff)
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
