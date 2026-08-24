import { NO_MATTER_TANK_ID } from '../../Matter/Tank/_MatterTank.types.ts'
import { ringBufferByteLength, RingBufferReader, RingBufferWriter } from '../../Util/RingBuffer.ts'

const CAPACITY = 8192

const SCHEMA = {
  tileX: Uint32Array,
  tileY: Uint32Array,
  ownerId: Uint32Array,
  // Source position override for create VFX (e.g. a flood-fill projectile's collision
  // tile) — sentinel -1 means "no override, use the tank's emit position" instead.
  srcX: Int32Array,
  srcY: Int32Array,
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
  writeTile(tx: number, ty: number, ownerId: number, srcPos?: { x: number; y: number }) {
    if (ownerId === NO_MATTER_TANK_ID) console.error('ownerId not found: ' + ownerId)
    this.writer.write((cursor) => {
      cursor.tileX = tx
      cursor.tileY = ty
      cursor.ownerId = ownerId
      cursor.srcX = srcPos?.x ?? -1
      cursor.srcY = srcPos?.y ?? -1
    })
  }

  writeTiles(tiles: ReadonlyArray<{ x: number; y: number }>, ownerId: number, srcPos?: { x: number; y: number }) {
    if (ownerId === NO_MATTER_TANK_ID) console.error('ownerId not found: ' + ownerId)
    this.writer.writeMany(tiles, (cursor, tile) => {
      cursor.tileX = tile.x
      cursor.tileY = tile.y
      cursor.ownerId = ownerId
      cursor.srcX = srcPos?.x ?? -1
      cursor.srcY = srcPos?.y ?? -1
    })
  }

  // Main thread side — sole writer of readHead.
  drain(callback: (tileX: number, tileY: number, ownerId: number, srcPos?: { x: number; y: number }) => void) {
    this.reader.drain((cursor) => {
      const srcPos = cursor.srcX >= 0 && cursor.srcY >= 0 ? { x: cursor.srcX, y: cursor.srcY } : undefined
      callback(cursor.tileX, cursor.tileY, cursor.ownerId, srcPos)
    })
  }
}
