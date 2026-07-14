import type { RectVerts } from '../../../Collision/_Collision.types.ts'
import { EMPTY, getOwner, matterType, PHYSICS_BODY } from '../../../Matter/_Matter.types.ts'
import { isLiquid } from '../../../Matter/matter.ts'
import { ParticleType } from '../../../Particles/_particle-types.ts'
import type { ChunkGrid } from '../../../Tilemap/ChunkGrid.ts'
import { type PhysicsBodiesData, PhysicsBodyStatus } from '../../data/PhysicsBodiesData.ts'
import type { MatterSim } from '../MatterSim/MatterSim.ts'
import type { ParticleSim } from '../ParticleSim/ParticleSim.ts'
import type { TileSet } from '../../data/SparseTileSet.ts'

const NO_OWNER = -1

// Minimum body speed (tiles/step) required to spawn a splash — slow-moving/resting bodies
// displacing liquid shouldn't kick off a splash.
const LIQUID_SPLASH_MIN_BODY_SPEED = 0.5

const SPLASH_PARTICLE_PERCENT = 25
const SPLASH_STEP = Math.max(1, Math.round(100 / SPLASH_PARTICLE_PERCENT))

export class PhysicsBodyProcessor {

  // slotIdx -> tile idx[]
  private readonly prevTiles = new Map<number, number[]>()

  // Slots currently touching at least one liquid tile. Splash should only fire on the
  // transition into this set (surface entry) — without it, a body sinking through liquid
  // keeps sweeping fresh liquid tiles under its leading edge every frame and re-triggers
  // the splash spawn continuously for the whole descent instead of once on contact.
  private readonly submergedSlots = new Set<number>()

  // tile idx -> owning slotIdx (or NO_OWNER). Prevents two overlapping bodies
  // from both believing they own the same PHYSICS_BODY tile: without this,
  // whichever body's footprint diff runs second on a shared tile would see it
  // as "not mine, must have been vacated" and stamp/release it, and the other
  // body would do the same next frame — a per-frame flicker between the two
  // that keeps calling reactivateAround (and bumping collGen) at the contact
  // point, which is what caused bodies to vibrate specifically when touching.
  private readonly tileOwner: Int16Array

  constructor(
    readonly data: PhysicsBodiesData,
    readonly tiles: Uint32Array,
    readonly chunkGrid: ChunkGrid,
    readonly sim: MatterSim,
    readonly particleSim: ParticleSim,
    readonly width: number,
    readonly height: number,
  ) {
    this.tileOwner = new Int16Array(width * height).fill(NO_OWNER)
  }

  process(activeSet: TileSet) {
    let status = this.data.status
    for (let i = 0; i < status.length; i++) {
      if (status[i] === PhysicsBodyStatus.ACTIVE) {
        this.rasterize(i, activeSet)
      } else if (status[i] === PhysicsBodyStatus.DESTROYED) {
        this.clearPrevTiles(i, activeSet)
        this.data.release(i)
      }
    }
  }

  private rasterizeDelta: { x: number, y: number } = { x: 0, y: 0 }

  private rasterizeVerts: RectVerts = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]

  // Reused across calls to avoid a per-frame allocation for the new footprint.
  private readonly newFootprint = new Set<number>()

  rasterize(slotIdx: number, activeSet: TileSet): void {
    const tiles = this.tiles
    const width = this.width
    const height = this.height
    const chunkGrid = this.chunkGrid

    const { x: dx, y: dy } = this.data.getDelta(slotIdx, this.rasterizeDelta)
    const verts = this.data.getPoints(slotIdx, this.rasterizeVerts)

    const dxSq = dx * dx
    const dySq = dy * dy
    const dist = Math.sqrt(dxSq + dySq)

    const stepsCeil = Math.ceil(dist * 2)
    const steps = Math.max(1, stepsCeil)

    let minX = verts[0].x
    let maxX = verts[0].x
    let minY = verts[0].y
    let maxY = verts[0].y

    for (let i = 1; i < verts.length; i++) {
      if (verts[i].x < minX) minX = verts[i].x
      if (verts[i].x > maxX) maxX = verts[i].x
      if (verts[i].y < minY) minY = verts[i].y
      if (verts[i].y > maxY) maxY = verts[i].y
    }

    const prevTiles = this.getPrevTiles(slotIdx)
    const newFootprint = this.newFootprint
    newFootprint.clear()

    // exclude as potential fill destination
    const displacedIndices = new Set<number>()

    const wasSubmerged = this.submergedSlots.has(slotIdx)
    let touchesLiquidThisFrame = false

    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const ox = dx * (1 - t)
      const oy = dy * (1 - t)

      const tx0Math = Math.floor(minX - ox)
      const tx0 = Math.max(0, tx0Math)

      const ty0Math = Math.floor(minY - oy)
      const ty0 = Math.max(0, ty0Math)

      const tx1Math = Math.ceil(maxX - ox)
      const tx1 = Math.min(width - 1, tx1Math)

      const ty1Math = Math.ceil(maxY - oy)
      const ty1 = Math.min(height - 1, ty1Math)

      const points: Set<number> = new Set()

      // Displacement below cascades through `points` in insertion order (each
      // processed tile excludes itself as a destination for the next one), so
      // always scanning left-to-right would always push residual water off
      // the right edge of the body. Alternate scan direction per frame
      // (mirrors the leftFirst convention the sim uses for horizontal flow)
      // so the cascade — and the resulting pile-up — flips sides instead of
      // being permanently biased right.
      const leftFirst = this.sim.leftFirst
      for (let ty = ty0; ty <= ty1; ty++) {
        for (
          let tx = leftFirst ? tx0 : tx1;
          leftFirst ? tx <= tx1 : tx >= tx0;
          tx += leftFirst ? 1 : -1
        ) {
          const px = tx + 0.5
          const py = ty + 0.5
          const inConvex = pointInConvex(
            px,
            py,
            verts,
            ox,
            oy,
          )

          if (inConvex) {
            const idx = ty * width + tx
            points.add(idx)
          }
        }
      }


      let i = -1
      for (const idx of points) {
        i++
        const raw = tiles[idx]
        const type = matterType(raw)

        const tx = idx % width
        const ty = (idx / width) | 0

        const typeIsLiquid = isLiquid(type)

        if (typeIsLiquid) {
          touchesLiquidThisFrame = true
        }

        if (i % SPLASH_STEP === 0) {
          if (typeIsLiquid) {
            if (!wasSubmerged && dist >= LIQUID_SPLASH_MIN_BODY_SPEED) {
              this.particleSim.spawn(ParticleType.LIQUID_SPLASH, tx + 0.5, ty + 0.5, getOwner(raw), dx, dy, type)
            }
            this.sim.doFillDisplace(tx, ty, idx, displacedIndices, activeSet)
          }
        }

        const isLastStep = step === steps
        if (isLastStep) {
          // Re-read the tile: doFillDisplace above may have just emptied it.
          const curType = matterType(tiles[idx])
          const owner = this.tileOwner[idx]
          // Claim if genuinely empty, or already ours. A tile another body
          // currently owns is left alone — we simply don't render there this
          // frame rather than fight over ownership.
          if (curType === EMPTY || (curType === PHYSICS_BODY && owner === slotIdx)) {
            newFootprint.add(idx)
          }
        }
      }
    }

    // Stamp the new footprint. Tiles already PHYSICS_BODY (and owned by us)
    // from the previous frame are left untouched (no tile write, no dirty
    // flag, no re-render) — only genuinely new tiles get written.
    //
    // A tile can be reserved here while still EMPTY, then later in this same
    // step's point loop become the destination of a *different* liquid tile's
    // doFillDisplace (destinations are only checked against the live tiles
    // array, and the PHYSICS_BODY write below doesn't happen until this loop
    // — so at displacement time it still reads as EMPTY and is a legal
    // target). Re-check here before overwriting: if it's live liquid now,
    // stamping over it would silently destroy that fill with no conservation
    // accounting. Drop the reservation instead — we'll try to claim it again
    // next frame once it's actually empty.
    for (const idx of newFootprint) {
      const curType = matterType(tiles[idx])
      if (curType === PHYSICS_BODY) {
        this.tileOwner[idx] = slotIdx
        continue
      }
      if (curType !== EMPTY) {
        newFootprint.delete(idx)
        continue
      }
      this.tileOwner[idx] = slotIdx
      tiles[idx] = PHYSICS_BODY
      const tx = idx % width
      const ty = (idx / width) | 0
      chunkGrid.markRenderDirtyTile(tx, ty)
    }

    // Release only tiles that left the footprint since last frame AND are
    // still owned by us (an overlapping body may have taken one over — in
    // that case it's no longer ours to release). Reactivating liquid
    // neighbours (which bumps collGen and forces the terrain collision mesh
    // to rebuild) only for genuinely vacated tiles — not the whole shape
    // every frame, and not tiles another body still holds — is what keeps a
    // body resting in water, including one touching another body, from
    // vibrating as the static ground body gets torn down and rebuilt.
    for (let i = 0; i < prevTiles.length; i++) {
      const idx = prevTiles[i]
      if (newFootprint.has(idx)) continue
      if (this.tileOwner[idx] !== slotIdx) continue
      if (matterType(tiles[idx]) !== PHYSICS_BODY) continue

      const tx = idx % width
      const ty = (idx / width) | 0

      tiles[idx] = EMPTY
      this.tileOwner[idx] = NO_OWNER
      chunkGrid.markRenderDirtyTile(tx, ty)
      this.sim.reactivateAround(tx, ty, activeSet)
    }

    prevTiles.length = 0
    for (const idx of newFootprint) prevTiles.push(idx)

    if (touchesLiquidThisFrame) {
      this.submergedSlots.add(slotIdx)
    } else {
      this.submergedSlots.delete(slotIdx)
    }

    // Signal the main thread that this slot's accumulated delta has been
    // consumed — it resets its position anchor on seeing this change, so the
    // *next* delta correctly represents distance since now, not since its
    // last render frame. See PhysicsBodiesData.markConsumed / PhysicsBody.ts.
    this.data.markConsumed(slotIdx)
  }

  getPrevTiles(slotIdx: number) {
    let prevTiles = this.prevTiles.get(slotIdx)
    if (prevTiles === undefined) {
      prevTiles = []
      this.prevTiles.set(slotIdx, prevTiles)
    }

    return prevTiles
  }

  clearPrevTiles(slotIdx: number, activeSet: TileSet) {
    this.submergedSlots.delete(slotIdx)
    let prevTiles = this.prevTiles.get(slotIdx)
    if (prevTiles === undefined) return
    const width = this.width
    const chunkGrid = this.chunkGrid
    const tiles = this.tiles

    for (let i = 0; i < prevTiles.length; i++) {
      const idx = prevTiles[i]
      if (this.tileOwner[idx] !== slotIdx) continue
      const raw = tiles[idx]
      const type = matterType(raw)
      if (type !== PHYSICS_BODY) {
        continue
      }

      const x = idx % width
      const y = (idx / width) | 0

      tiles[idx] = EMPTY
      this.tileOwner[idx] = NO_OWNER
      chunkGrid.markRenderDirtyTile(x, y)
      // Wake any settled liquid around the vacated tile so it flows back in
      // instead of leaving a permanent air pocket where the body used to be.
      this.sim.reactivateAround(x, y, activeSet)
    }
    prevTiles.length = 0
  }
}

function pointInConvex(
  px: number,
  py: number,
  verts: { x: number; y: number }[],
  ox: number,
  oy: number,
): boolean {
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]
    const nextIdx = (i + 1) % verts.length
    const b = verts[nextIdx]

    const ax = a.x - ox
    const ay = a.y - oy
    const bx = b.x - ox
    const by = b.y - oy

    const cross1 = bx - ax
    const cross2 = py - ay
    const cross3 = by - ay
    const cross4 = px - ax
    const crossResult = cross1 * cross2 - cross3 * cross4

    if (crossResult < 0) return false
  }

  return true
}