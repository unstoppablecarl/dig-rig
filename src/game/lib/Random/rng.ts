export function createWeightedRandom<T>(
  items: readonly T[],
  weights: readonly number[],
): () => T {
  if (items.length !== weights.length) {
    throw new Error('Items and weights must have the same length')
  }

  if (items.length === 0) {
    throw new Error('Cannot create picker from empty array')
  }

  // Pre-calculate total weight for better performance
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  // Return a new function that can be called repeatedly
  return function weightedRandomPicker(rng: () => number = Math.random): T {
    let random = rng() * totalWeight

    for (let i = 0; i < items.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        return items[i]
      }
    }

    // Fallback (in case of floating point precision issues)
    return items[items.length - 1]
  }
}