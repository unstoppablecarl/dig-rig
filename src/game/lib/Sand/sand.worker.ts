/// <reference lib="webworker" />

const EMPTY = 0
const SOLID = 1
const SAND = 3

let tiles: Uint8Array
let dirty: Uint8Array
let width = 0
let height = 0
let chunkSize = 0
let chunksWidth = 0
let activeSet = new Set<number>()
let ready = false

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data

  if (type === 'init') {
    tiles = new Uint8Array(e.data.tilesBuffer as SharedArrayBuffer)
    dirty = new Uint8Array(e.data.dirtyBuffer as SharedArrayBuffer)
    width = e.data.width as number
    height = e.data.height as number
    chunkSize = e.data.chunkSize as number
    chunksWidth = Math.ceil(width / chunkSize)
    ready = true
    setInterval(step, 16)
    return
  }

  if (type === 'activate') {
    for (const idx of e.data.indices as number[]) {
      if (idx >= 0 && idx < tiles.length && (tiles[idx] === SAND || tiles[idx] === SOLID)) {
        activeSet.add(idx)
      }
    }
  }
}

function markDirty(tx: number, ty: number) {
  dirty[(ty / chunkSize | 0) * chunksWidth + (tx / chunkSize | 0)] = 1
}

function tryMove(fromIdx: number, fromTx: number, fromTy: number, toTx: number, toTy: number, next: Set<number>): boolean {
  if (toTx < 0 || toTx >= width || toTy < 0 || toTy >= height) return false
  const toIdx = toTy * width + toTx
  if (tiles[toIdx] !== EMPTY) return false

  tiles[fromIdx] = EMPTY
  tiles[toIdx] = SAND
  markDirty(fromTx, fromTy)
  markDirty(toTx, toTy)
  next.add(toIdx)
  return true
}

function step() {
  if (!ready || activeSet.size === 0) return

  // Sort descending by index so bottom rows (higher y = higher index) are processed first.
  // This prevents a sand tile from being moved twice in one step.
  const current = [...activeSet].sort((a, b) => b - a)
  const next = new Set<number>()
  const justSettled: number[] = []

  for (const idx of current) {
    if (tiles[idx] !== SAND) continue

    const tx = idx % width
    const ty = idx / width | 0
    const leftFirst = Math.random() < 0.5

    const moved =
      tryMove(idx, tx, ty, tx, ty + 1, next) ||
      tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, next) ||
      tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, next)

    if (!moved) {
      tiles[idx] = SOLID
      markDirty(tx, ty)
      justSettled.push(idx)
    }
  }

  activeSet = next

  if (justSettled.length > 0) {
    self.postMessage({ type: 'settled', indices: justSettled })
  }
}
