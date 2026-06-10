import { ref } from 'vue'

export function makeArrayCyclerRef<T>(
  source: T[],
  initialValue: T,
) {

  const value = ref<T>(initialValue)

  function prev() {
    let index: number
    const currentIndex = source.indexOf(value.value)
    if (currentIndex === 0) {
      index = source.length - 1
    } else {
      index = currentIndex - 1
    }
    value.value = source[index]
  }

  function next() {
    let index: number
    const currentIndex = source.indexOf(value.value)

    if (currentIndex === source.length - 1) {
      index = 0
    } else {
      index = currentIndex + 1
    }
    value.value = source[index]
  }

  return {
    value,
    prev,
    next,
  }
}
