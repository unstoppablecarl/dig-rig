export type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor;

export type Schema = {
  [key: string]: TypedArrayConstructor
};

export type Views<T extends Schema> = {
  [K in keyof T]: InstanceType<T[K]>
};

export type Buffers<T extends Schema> = Record<keyof T, SharedArrayBuffer>

export type DataPlane<T extends Schema> = {
  views: Views<T>,
  buffers: Buffers<T>,
};

// Infers the primitive type (e.g., `number`) directly from the typed array instance
export type Cursor<T> = {
  index: number
} & {
  [K in keyof T]: T[K] extends { [n: number]: infer R } ? R : never
};

export function makeDataPlane<T extends Schema>(schema: T, maxItems: number): DataPlane<T> {
  const views = {} as Views<T>
  const buffers = {} as Record<keyof T, SharedArrayBuffer>

  for (const [key, Constructor] of Object.entries(schema)) {
    const byteLength = maxItems * Constructor.BYTES_PER_ELEMENT
    const buffer = new SharedArrayBuffer(byteLength)

    buffers[key as keyof T] = buffer
    views[key as keyof T] = new Constructor(buffer as unknown as ArrayBuffer) as InstanceType<T[keyof T]>
  }

  return {
    views,
    buffers,
  }
}

export function makeSOABuffers<T extends Schema>(schema: T, maxItems: number): Record<keyof T, SharedArrayBuffer> {
  const buffers = {} as Record<keyof T, SharedArrayBuffer>

  for (const [key, Constructor] of Object.entries(schema)) {
    const byteLength = maxItems * Constructor.BYTES_PER_ELEMENT
    buffers[key as keyof T] = new SharedArrayBuffer(byteLength)
  }

  return buffers
}

export function soaBuffersToViews<T extends Schema>(schema: T, buffers: Record<keyof T, SharedArrayBuffer>): Views<T> {
  const views = {} as Views<T>

  for (const [key, Constructor] of Object.entries(schema)) {
    views[key as keyof T] = new Constructor(buffers[key] as unknown as ArrayBuffer) as InstanceType<T[keyof T]>
  }

  return views
}

export function makeFlyweightCursor<T extends Record<string, any>>(views: T): (index: number) => Cursor<T> {
  const cursor = {
    index: 0,
  } as Cursor<T>

  const keys = Object.keys(views) as Array<keyof T>

  keys.forEach((key) => {
    const descriptor: PropertyDescriptor = {
      get: function() {
        return views[key][cursor.index]
      },
      set: function(value: any) {
        views[key][cursor.index] = value
      },
    }

    Object.defineProperty(cursor, key as string | symbol, descriptor)
  })

  return function(index: number) {
    cursor.index = index

    return cursor
  }
}