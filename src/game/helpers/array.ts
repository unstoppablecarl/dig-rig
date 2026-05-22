
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
  // Create a shallow copy to avoid modifying the original array if desired.
  const shuffled = [...array]
  let currentIndex = shuffled.length
  let randomIndex

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--;

    // And swap it with the current element.
    [shuffled[currentIndex], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[currentIndex],
    ]
  }

  return shuffled
}