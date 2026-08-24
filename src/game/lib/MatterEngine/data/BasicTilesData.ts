import { ringBufferByteLength, RingBufferReader, RingBufferWriter } from '../../Util/RingBuffer.ts'

const SCHEMA = { idx: Uint32Array }

export type BasicTilesBuffer = {
  tiles: SharedArrayBuffer,
  capacity: number,
}

export class BasicTilesData {
  private readonly writer: RingBufferWriter<typeof SCHEMA>
  private readonly reader: RingBufferReader<typeof SCHEMA>

  static makeBuffer(width: number, height: number): BasicTilesBuffer {
    const capacity = width * height

    const BYTE_LENGTH = ringBufferByteLength(SCHEMA, capacity)

    return {
      tiles: new SharedArrayBuffer(BYTE_LENGTH),
      capacity,
    }
  }

  readonly buffer: SharedArrayBuffer

  constructor({ tiles, capacity }: BasicTilesBuffer) {
    this.writer = new RingBufferWriter(SCHEMA, capacity, tiles)
    this.reader = new RingBufferReader(SCHEMA, capacity, tiles)
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
