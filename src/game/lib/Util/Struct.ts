import { type Schema } from './StructOfArrays'

export type StructFields<T extends Schema> = {
  [K in keyof T]: number
}

function structByteLength<T extends Schema>(schema: T): number {
  let offset = 0
  for (const [, Constructor] of Object.entries(schema)) {
    const align = Constructor.BYTES_PER_ELEMENT
    offset = (offset + align - 1) & ~(align - 1)
    offset += Constructor.BYTES_PER_ELEMENT
  }
  return offset
}

export function makeStructFactory<T extends Schema>(schema: T) {
  const byteLength = structByteLength(schema)

  function make() {
    const buffer = new SharedArrayBuffer(byteLength)
    return fromBuffer(buffer)
  }

  function fromBuffer(buffer: SharedArrayBuffer) {
    return makeStruct(schema, buffer)
  }

  return {
    makeBuffer() {
      return new SharedArrayBuffer(byteLength)
    },
    make,
    fromBuffer,
  }
}

export type StructInstance<T extends Schema> = StructFields<T> & {
  buffer: SharedArrayBuffer
}

export function makeStruct<T extends Schema>(schema: T, buffer: SharedArrayBuffer): StructInstance<T> {
  let offset = 0
  const struct = {
    buffer,
  } as StructInstance<T>
  for (const [key, Constructor] of Object.entries(schema)) {
    const align = Constructor.BYTES_PER_ELEMENT
    offset = (offset + align - 1) & ~(align - 1)
    const view = new Constructor(buffer as unknown as ArrayBuffer, offset, 1)
    Object.defineProperty(struct, key, {
      get() {
        return view[0]
      },
      set(v: number) {
        view[0] = v
      },
      enumerable: true,
    })
    offset += Constructor.BYTES_PER_ELEMENT
  }
  return struct
}
