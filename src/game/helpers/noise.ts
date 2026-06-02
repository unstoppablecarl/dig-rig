import { createNoise3D } from 'simplex-noise'

export function makeCachedSimplexNoise(lifespanMs: number, size: number = 256) {
  const WIND_LUT_MASK = size - 1
  const WIND_LUT_PERIOD = lifespanMs / size  // ms per slot
  const WIND_LUT_X = new Float32Array(size)
  const WIND_LUT_Y = new Float32Array(size)
  const n = createNoise3D()
  const tRange = lifespanMs * 0.01
  for (let i = 0; i < size; i++) {
    const nt = (i / size) * tRange
    WIND_LUT_X[i] = n(0, 0, nt)
    WIND_LUT_Y[i] = n(1000, 1000, nt)
  }

  return {
    WIND_LUT_MASK,
    WIND_LUT_PERIOD,
    WIND_LUT_X,
    WIND_LUT_Y,
  }
}