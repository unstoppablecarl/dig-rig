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