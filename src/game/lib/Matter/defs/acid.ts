import { random } from '../../../helpers/random'
import { ACID_IMMUNE } from '../_Matter-meta'
import {
  ACID,
  EMPTY,
  type MatterDef,
  matterType,
  MatterTypeSet,
  SALT_WATER,
  setSettled,
  SOLID,
  WATER,
} from '../_Matter-types.ts'

const IS_SETTLED = new MatterTypeSet(ACID, EMPTY)

export const ACID_DEF: MatterDef = {
  name: 'Acid',
  liquid: true,
  acidImmune: true,
  action(world, tx, ty, idx, next): void {
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

        world.queueTransferToMatterTankOwner(tx, ty, idx)
        tiles[idx] = EMPTY
        tiles[nidx] = EMPTY
        world.markDirty(tx, ty)
        world.markDirty(nx, ny)
        next.add(nidx)
        next.add(idx)
        // world.reactivateAround(tx, ty, next)
        return
      }
    }

    // Acid is denser than water and salt-water — sink through them
    if (world.doDensityLiquid(tx, ty, idx, next, WATER, 25, 30)) return
    if (world.doDensityLiquid(tx, ty, idx, next, SALT_WATER, 25, 30)) return
    if (world.hasDensityBelow(tx, ty, WATER) || world.hasDensityBelow(tx, ty, SALT_WATER)) {
      next.add(idx)
      return
    }

    // stickiness
    const touchingSolid = world.bordering(tx, ty, idx, SOLID) !== -1
    if (touchingSolid && random() < 95) {
      next.add(idx)
      return
    }

    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

    if (!moved) {
      world.tiles[idx] = setSettled(world.tiles[idx], true)
      world.markDirty(tx, ty)

      if (!world.surroundedByMask(tx, ty, idx, IS_SETTLED)) {
        next.add(idx)
      }
    }
  },
}