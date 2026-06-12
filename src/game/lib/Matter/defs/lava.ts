import { random } from '../../../helpers/random'
import { ParticleType } from '../../Particles/_particle-types.ts'
import { LAVA_IMMUNE } from '../_Matter-meta.ts'
import {
  EMPTY,
  FIRE,
  getOwner,
  LAVA,
  type MatterDef,
  matterType,
  MatterTypeSet,
  OIL,
  ROCK,
  SALT_WATER,
  setOwner,
  setSettled,
  SOLID,
  STEAM,
  WATER,
} from '../_Matter.types.ts'
import { MatterCoordinatorOutMsg } from '../MatterSim.types.ts'

const IS_SETTLED = new MatterTypeSet(LAVA, EMPTY)

const COOLED = new MatterTypeSet(WATER, SALT_WATER)
export const LAVA_DEF: MatterDef = {
  name: 'Lava',
  lavaImmune: true,
  liquid: true,
  action(world, tx, ty, idx): void {
    const { tiles, width, height } = world
    const existing = tiles[idx]
    const ownerId = getOwner(existing)
    // Turn to rock when touching water or salt-water
    let waterLoc = world.borderingAny(tx, ty, idx, COOLED)
    if (waterLoc !== -1) {
      tiles[waterLoc] = STEAM
      tiles[idx] = ROCK
      world.markDirty(tx, ty)
      const wx = waterLoc % width
      const wy = waterLoc / width | 0
      world.markDirty(wx, wy)
      world.next.add(waterLoc)
      world.next.add(idx)
      return
    }

    // Spawn a lava burst particle and self-destruct when adjacent to oil
    if (random() < 14 && world.bordering(tx, ty, idx, OIL) !== -1) {
      postMessage({
        type: MatterCoordinatorOutMsg.SPAWN_PARTICLE,
        particleType: ParticleType.LAVA_BURST,
        x: tx,
        y: ty,
      })
      tiles[idx] = EMPTY
      world.markDirty(tx, ty)
      world.reactivateAround(tx, ty)
      return
    }

    // Slowly melt adjacent SOLID (SOLID is lava immune otherwise)
    if (random() < 1 && random() < 50) {
      const meltLoc = world.borderingAdjacent(tx, ty, idx, SOLID)
      if (meltLoc !== -1) {
        tiles[meltLoc] = EMPTY
        world.queueMatterCreditFromTile(tx, ty, idx)
        tiles[idx] = EMPTY
        const mx = meltLoc % width
        const my = meltLoc / width | 0
        world.markDirty(mx, my)
        world.markDirty(tx, ty)
        world.next.add(idx)
        world.next.add(meltLoc)
      }
    }
    //
    // // Spawn fire in empty space directly above
    const upIdx = ty > 0 ? idx - width : -1
    if (upIdx !== -1 && random() < 6 && matterType(tiles[upIdx]) === EMPTY) {
      tiles[upIdx] = setOwner(FIRE, ownerId)
      world.markDirty(tx, ty - 1)
      world.next.add(upIdx)
    }

    // Burn adjacent non-immune tiles (4-directional, SOLID is lava-immune so skipped)
    if (random() < 25) {
      const burnCandidates: [number, number, number][] = [
        [tx, ty - 1, ty > 0 ? idx - width : -1],
        [tx, ty + 1, ty < height - 1 ? idx + width : -1],
        [tx - 1, ty, tx > 0 ? idx - 1 : -1],
        [tx + 1, ty, tx < width - 1 ? idx + 1 : -1],
      ]
      for (const [nx, ny, nidx] of burnCandidates) {
        if (nidx === -1) continue
        const nt = matterType(tiles[nidx])
        if (!LAVA_IMMUNE.has(nt)) {
          tiles[nidx] = setOwner(FIRE, ownerId)
          world.queueMatterCredit(tx, ty, ownerId)
          tiles[idx] = EMPTY
          world.markDirty(nx, ny)
          world.next.add(nidx)
        }
      }
    }

    // Clear fire directly below so lava can fall through it
    const downIdx = ty < height - 1 ? idx + width : -1
    if (downIdx !== -1) {
      const belowType = matterType(tiles[downIdx])
      if (belowType === FIRE) {
        tiles[downIdx] = EMPTY
        world.markDirty(tx, ty + 1)
        world.reactivateAround(tx, ty + 1)
      } else if (belowType === STEAM && random() < 95) {
        // Lava sinks through steam — swap positions
        tiles[downIdx] = LAVA
        tiles[idx] = STEAM
        world.markDirty(tx, ty)
        world.markDirty(tx, ty + 1)
        world.next.add(downIdx)
        world.next.add(idx)
        return
      }
    }

    // 15% chance to clear fire sideways so lava can flow horizontally through it
    if (random() < 15) {
      const leftIdx = tx > 0 ? idx - 1 : -1
      const rightIdx = tx < width - 1 ? idx + 1 : -1
      if (leftIdx !== -1 && matterType(tiles[leftIdx]) === FIRE) {
        tiles[leftIdx] = EMPTY
        world.markDirty(tx - 1, ty)
        world.reactivateAround(tx - 1, ty)
      }
      if (rightIdx !== -1 && matterType(tiles[rightIdx]) === FIRE) {
        tiles[rightIdx] = EMPTY
        world.markDirty(tx + 1, ty)
        world.reactivateAround(tx + 1, ty)
      }
    }

    const moved = world.tryLiquidFlow(tx, ty, idx)
    if (!moved) {
      world.tiles[idx] = setSettled(existing, true)
      world.markDirty(tx, ty)

      if (!world.surroundedByAny(tx, ty, idx, IS_SETTLED)) {
        world.next.add(idx)
      }
    }
  },
}
