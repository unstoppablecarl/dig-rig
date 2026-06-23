import { type Cursor, makeFlyweightCursor, type Schema, type Views } from './StructOfArrays'

const HEADER_BYTES = 8  // writeHead (Int32) + readHead (Int32)

// Layout: [writeHead: Int32, readHead: Int32, ...field arrays in schema order]
// Each field array is capacity-many elements of its typed array type.
// Field start offsets are aligned to their element size.

export function ringBufferByteLength<T extends Schema>(schema: T, capacity: number): number {
  let offset = HEADER_BYTES
  for (const [, Constructor] of Object.entries(schema)) {
    const align = Constructor.BYTES_PER_ELEMENT
    offset = (offset + align - 1) & ~(align - 1)
    offset += capacity * Constructor.BYTES_PER_ELEMENT
  }
  return offset
}

function buildViews<T extends Schema>(schema: T, capacity: number, sab: SharedArrayBuffer): Views<T> {
  let offset = HEADER_BYTES
  const views = {} as Views<T>
  for (const [key, Constructor] of Object.entries(schema)) {
    const align = Constructor.BYTES_PER_ELEMENT
    offset = (offset + align - 1) & ~(align - 1)
    views[key as keyof T] = new Constructor(sab as unknown as ArrayBuffer, offset, capacity) as InstanceType<T[keyof T]>
    offset += capacity * Constructor.BYTES_PER_ELEMENT
  }
  return views
}

// Sole writer of heads[0] (writeHead).
export class RingBufferWriter<T extends Schema> {
  private readonly heads: Int32Array
  private readonly seek: (index: number) => Cursor<Views<T>>
  private readonly capacity: number

  constructor(schema: T, capacity: number, sab: SharedArrayBuffer) {
    this.heads = new Int32Array(sab, 0, 2)
    this.seek = makeFlyweightCursor(buildViews(schema, capacity, sab))
    this.capacity = capacity
  }

  write(fn: (cursor: Cursor<Views<T>>) => void): boolean {
    const head = this.heads[0]
    const used = ((head - Atomics.load(this.heads, 1)) >>> 0)
    if (used >= this.capacity) {
      console.warn(`RingBuffer full (capacity=${this.capacity}), dropping 1 write`)
      return false
    }
    fn(this.seek(head % this.capacity))
    Atomics.store(this.heads, 0, (head + 1) | 0)
    return true
  }

  writeMany<U>(items: ReadonlyArray<U>, fn: (cursor: Cursor<Views<T>>, item: U) => void): number {
    let head = this.heads[0]
    const used = ((head - Atomics.load(this.heads, 1)) >>> 0)
    const available = used >= this.capacity ? 0 : this.capacity - used
    const toWrite = Math.min(available, items.length)
    if (toWrite < items.length) {
      console.warn(`RingBuffer full (capacity=${this.capacity}), dropping ${items.length - toWrite} writes`)
    }
    for (let i = 0; i < toWrite; i++) {
      fn(this.seek(head % this.capacity), items[i])
      head = (head + 1) | 0
    }
    Atomics.store(this.heads, 0, head)
    return toWrite
  }
}

// Sole writer of heads[1] (readHead).
export class RingBufferReader<T extends Schema> {
  private readonly heads: Int32Array
  private readonly seek: (index: number) => Cursor<Views<T>>
  private readonly capacity: number

  constructor(schema: T, capacity: number, sab: SharedArrayBuffer) {
    this.heads = new Int32Array(sab, 0, 2)
    this.seek = makeFlyweightCursor(buildViews(schema, capacity, sab))
    this.capacity = capacity
  }

  drain(fn: (cursor: Cursor<Views<T>>) => void): void {
    const writeHead = Atomics.load(this.heads, 0)
    let readHead = this.heads[1]
    while (readHead !== writeHead) {
      fn(this.seek(readHead % this.capacity))
      readHead = (readHead + 1) | 0
    }
    Atomics.store(this.heads, 1, readHead)
  }

  // Read exactly n entries. Caller must ensure n entries are available.
  read(n: number, fn: (cursor: Cursor<Views<T>>) => void): void {
    let readHead = this.heads[1]
    for (let i = 0; i < n; i++) {
      fn(this.seek(readHead % this.capacity))
      readHead = (readHead + 1) | 0
    }
    Atomics.store(this.heads, 1, readHead)
  }
}
