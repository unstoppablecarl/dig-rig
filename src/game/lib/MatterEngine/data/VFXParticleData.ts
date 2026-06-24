import { ringBufferByteLength, RingBufferReader, RingBufferWriter } from '../../Util/RingBuffer.ts'

const CAPACITY = 8192

const SCHEMA = {
  tileX: Uint32Array,
  tileY: Uint32Array,
  ownerId: Uint32Array,
}

const BYTE_LENGTH = ringBufferByteLength(SCHEMA, CAPACITY)

export class VFXParticleData {
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
  writeTile(tx: number, ty: number, ownerId: number) {
    this.writer.write((cursor) => {
      cursor.tileX = tx
      cursor.tileY = ty
      cursor.ownerId = ownerId
    })
  }

  writeTiles(tiles: ReadonlyArray<{ x: number; y: number }>, ownerId: number) {
    this.writer.writeMany(tiles, (cursor, tile) => {
      cursor.tileX = tile.x
      cursor.tileY = tile.y
      cursor.ownerId = ownerId
    })
  }

  // Main thread side — sole writer of readHead.
  drain(callback: (tileX: number, tileY: number, ownerId: number) => void) {
    this.reader.drain((cursor) => {
      callback(cursor.tileX, cursor.tileY, cursor.ownerId)
    })
  }
}
