import { random } from '../../../helpers/random'
import { ACID, EMPTY, SALT_WATER, SETTLED_FLAG, WATER } from '../_Matter-types.ts'
import { ACID_IMMUNE, type ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: ACID,
  name: 'Acid',
  liquid: true,
  acidImmune: true,
  action(world, tx, ty, idx, next): void {
    const { tiles, width, height } = world

    // Dissolve a bordering tile
    if (random() < 10) {
      const neighbors = [
        [tx, ty + 1, idx + width],
        [tx, ty - 1, idx - width],
        [tx - 1, ty, idx - 1],
        [tx + 1, ty, idx + 1],
      ] as [number, number, number][]

      for (const [nx, ny, nidx] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const nt = tiles[nidx] & 0x7F
        if (ACID_IMMUNE.has(nt)) continue

        if (ny === ty + 1) {
          // Falling into target — acid moves down, target is destroyed
          tiles[idx] = EMPTY
          tiles[nidx] = ACID
          world.markDirty(tx, ty)
          world.markDirty(nx, ny)
          next.add(nidx)
          world.reactivateAround(tx, ty, next)
          return
        } else {
          // Dissolve sideways/up — target gone, acid stays
          tiles[nidx] = EMPTY
          world.markDirty(nx, ny)
          world.reactivateAround(nx, ny, next)
          next.add(idx)
          return
        }
      }
    }

    // Acid is denser than water and salt-water — sink through them
    if (world.doDensityLiquid(tx, ty, idx, next, WATER, 25, 30)) return
    if (world.doDensityLiquid(tx, ty, idx, next, SALT_WATER, 25, 30)) return
    if (world.hasDensityBelow(tx, ty, WATER) || world.hasDensityBelow(tx, ty, SALT_WATER)) {
      next.add(idx)
      return
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx, ty + 1, ACID, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 : 1), ty + 1, ACID, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? 1 : -1), ty + 1, ACID, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 : 1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? 1 : -1, next)

    if (!moved) {
      world.tiles[idx] = ACID | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
