import { Math as PMath } from 'phaser'
import DegToRad = PMath.DegToRad

// Pre-generated random table: returns integer 0–99 without float overhead.
const RNG_SIZE = 8192
const _rngTable = new Uint8Array(RNG_SIZE)
let _rngIdx = 0
for (let i = 0; i < RNG_SIZE; i++) _rngTable[i] = Math.floor(Math.random() * 100)

export function random(): number {
  const v = _rngTable[_rngIdx]
  _rngIdx = (_rngIdx + 1) % RNG_SIZE
  return v
}

export function randomRange(min: number, max: number): number {
  if (min > max) {
    [min, max] = [max, min]
  }

  return Math.random() * (max - min) + min
}

export function randomRangeInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min)
}

export function randomDegVarianceToRad(spreadDeg: number) {
  return DegToRad((Math.random() - 0.5) * spreadDeg)
}

export function shuffleArray(array: Array<number>) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = random() % (i + 1)
    const tmp = array[i]
    array[i] = array[j]
    array[j] = tmp
  }
  return array
}