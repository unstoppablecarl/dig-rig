import { ringBufferByteLength, RingBufferReader, RingBufferWriter } from '../../Util/RingBuffer.ts'

const CAPACITY = 16384

const SCHEMA = { idx: Uint32Array }

const BYTE_LENGTH = ringBufferByteLength(SCHEMA, CAPACITY)

export class ActivateTilesData {
  private readonly writer: RingBufferWriter<typeof SCHEMA>
  private readonly reader: RingBufferReader<typeof SCHEMA>

  static makeBuffer(): SharedArrayBuffer {
    return new SharedArrayBuffer(BYTE_LENGTH)
  }

  constructor(readonly buffer: SharedArrayBuffer) {
    this.writer = new RingBufferWriter(SCHEMA, CAPACITY, buffer)
    this.reader = new RingBufferReader(SCHEMA, CAPACITY, buffer)
  }

  // Main thread side — write tile indices to wake up.
  write(idx: number) {
    this.writer.write((cursor) => {
      cursor.idx = idx
    })
  }

  // Coordinator side — drain indices written by main thread.
  drain(callback: (idx: number) => void) {
    this.reader.drain((cursor) => callback(cursor.idx))
  }
}
