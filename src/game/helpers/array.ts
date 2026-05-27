
// removes an element from an array in-place using the swap-and-pop method.
export function removeIndex<T>(arr: T[], indexToRemove: number): void {
  // Check if the index is valid
  if (indexToRemove < 0 || indexToRemove >= arr.length) {
    throw new Error(`Invalid index ${indexToRemove} for array of length ${arr.length}. No operation performed.`)
  }

  const lastIndex = arr.length - 1

  if (indexToRemove !== lastIndex) {
    // replace the element to be removed with the last element
    arr[indexToRemove] = arr[lastIndex]
  }

  arr.pop()
}

export function truncateArrayRandomly<T>(arr: T[], targetSize: number): T[] {
  if (targetSize < 0) {
    throw new Error('Target size cannot be negative')
  }
  if (targetSize >= arr.length) {
    return arr
  }
  while (arr.length > targetSize) {
    const randomIndex = Math.floor(Math.random() * arr.length)
    arr.splice(randomIndex, 1)
  }
  return arr
}

export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = array[i]
    array[i] = array[j]
    array[j] = tmp
  }
  return array
}