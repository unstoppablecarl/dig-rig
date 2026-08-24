import type { MatterTankId } from '../../Matter/Tank/_MatterTank.types.ts'
import { ringBufferByteLength, RingBufferReader, RingBufferWriter } from '../../Util/RingBuffer.ts'

const CAPACITY = 8192

const SCHEMA = {
  fromOwnerId: Uint32Array,
  toOwnerId: Uint32Array,
  amount: Uint32Array,
}

const BYTE_LENGTH = ringBufferByteLength(SCHEMA, CAPACITY)

export class VFXParticleOverflowData {
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
  write(from: MatterTankId, to: MatterTankId, amount: number) {
    this.writer.write((cursor) => {
      cursor.fromOwnerId = from
      cursor.toOwnerId = to
      cursor.amount = amount
    })
  }

  // Main thread side — sole writer of readHead.
  drain(callback: (from: MatterTankId, to: MatterTankId, amount: number) => void) {
    this.reader.drain((cursor) => {
      callback(cursor.fromOwnerId as MatterTankId, cursor.toOwnerId as MatterTankId, cursor.amount)
    })
  }
}
