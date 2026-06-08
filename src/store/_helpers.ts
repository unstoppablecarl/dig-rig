import { computed, markRaw, shallowRef } from 'vue'

export function rawRef<T extends object | null>(initial: T = null as T) {
  const inner = shallowRef<T>(initial)
  return computed({
    get: () => inner.value,
    set: (v: T) => { inner.value = v ? markRaw(v) : null as T },
  })
}
