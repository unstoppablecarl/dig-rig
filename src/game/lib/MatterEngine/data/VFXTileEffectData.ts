import { FIRE_MODE_COLORS } from '../../../config/colors.ts'
import type { FireMode } from '../../Player/_FireMode-types.ts'
import { ringBufferByteLength, RingBufferReader, RingBufferWriter } from '../../Util/RingBuffer.ts'

const CAPACITY = 8192

const SCHEMA = {
  tileX: Uint32Array,
  tileY: Uint32Array,
  color: Uint32Array,
}

const BYTE_LENGTH = ringBufferByteLength(SCHEMA, CAPACITY)

export class VFXTileEffectData {
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
  writeFireModeTiles(tiles: ReadonlyArray<{ x: number; y: number }>, mode: FireMode) {
    const color = FIRE_MODE_COLORS[mode].color
    this.writer.writeMany(tiles, (cursor, tile) => {
      cursor.tileX = tile.x
      cursor.tileY = tile.y
      cursor.color = color
    })
  }

  writeTiles(tiles: ReadonlyArray<{ x: number; y: number }>, color: number) {
    this.writer.writeMany(tiles, (cursor, tile) => {
      cursor.tileX = tile.x
      cursor.tileY = tile.y
      cursor.color = color
    })
  }

  // Main thread side — sole writer of readHead.
  drain(callback: (tileX: number, tileY: number, color: number) => void) {
    this.reader.drain((cursor) => {
      callback(cursor.tileX, cursor.tileY, cursor.color)
    })
  }
}
