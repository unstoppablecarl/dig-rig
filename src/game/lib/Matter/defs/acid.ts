import { random } from '../../../helpers/random'
import { ACID_IMMUNE } from '../_Matter-meta'
import {
  ACID,
  EMPTY, getOwner,
  type MatterDef,
  matterType,
  MatterTypeSet,
  SALT_WATER,
  setSettled,
  SOLID,
  WATER,
} from '../_Matter.types.ts'

const IS_SETTLED = new MatterTypeSet(ACID, EMPTY)

export const ACID_DEF: MatterDef = {
  name: 'Acid',
  liquid: true,
  acidImmune: true,
  action(world, tx, ty, idx): void {
    const { tiles, width, height } = world
    const leftFirst = world.leftFirst

    // Dissolve a bordering tile
    if (random() < 10) {
      const leftNeighbor = [tx - 1, ty, idx - 1]
      const rightNeighbor = [tx + 1, ty, idx + 1]

      const neighbors = [
        leftFirst ? leftNeighbor : rightNeighbor,
        leftFirst ? rightNeighbor : leftNeighbor,
        [tx, ty + 1, idx + width],
        [tx, ty - 1, idx - width],
      ] as [number, number, number][]

      for (const [nx, ny, nidx] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

        const nt = matterType(tiles[nidx])
        if (ACID_IMMUNE.has(nt)) continue

        const ownerId = getOwner(tiles[idx])
        world.queueMatterCredit(tx, ty, ownerId)
        tiles[idx] = EMPTY
        world.markDirty(tx, ty)
        world.next.add(idx)

        world.queueMatterCredit(nx, ny, ownerId)
        tiles[nidx] = EMPTY
        world.markDirty(nx, ny)
        world.next.add(nidx)
        return
      }
    }

    // Acid is denser than water and salt-water — sink through them
    if (world.doDensityLiquid(tx, ty, idx, WATER, 25, 30)) return
    if (world.doDensityLiquid(tx, ty, idx, SALT_WATER, 25, 30)) return
    if (world.hasDensityBelow(tx, ty, WATER) || world.hasDensityBelow(tx, ty, SALT_WATER)) {
      world.next.add(idx)
      return
    }

    // stickiness
    const touchingSolid = world.bordering(tx, ty, idx, SOLID) !== -1
    if (touchingSolid && random() < 95) {
      world.next.add(idx)
      return
    }

    const moved = world.tryLiquidFlow(tx, ty, idx)
    if (!moved) {
      world.tiles[idx] = setSettled(world.tiles[idx], true)
      world.markDirty(tx, ty)

      if (!world.surroundedByAny(tx, ty, idx, IS_SETTLED)) {
        world.next.add(idx)
      }
    }
  },
}