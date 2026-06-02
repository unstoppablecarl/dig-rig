import { random } from '../../../helpers/random'
import { FIRE, LAVA, MatterType, ROCK, SALT_WATER, SETTLED_FLAG, STEAM, WATER } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

// Elements lava cannot burn
const LAVA_IMMUNE = new Set([LAVA, MatterType.SOLID, MatterType.PERMANENT, ROCK, WATER, SALT_WATER, STEAM])

const def: ElementDef = {
  id: MatterType.LAVA,
  name: 'Lava',
  action(world, tx, ty, idx, next): void {
    const { tiles, width } = world

    // Turn to rock when touching water or salt-water
    let waterLoc = world.bordering(tx, ty, idx, WATER)
    if (waterLoc === -1) waterLoc = world.bordering(tx, ty, idx, SALT_WATER)
    if (waterLoc !== -1) {
      tiles[waterLoc] = STEAM
      tiles[idx] = ROCK
      world.markDirty(tx, ty)
      const wx = waterLoc % width
      const wy = waterLoc / width | 0
      world.markDirty(wx, wy)
      next.add(waterLoc)
      return
    }

    // Burn adjacent non-immune tiles
    if (random() < 25) {
      const neighbors = [
        idx - width, idx + width, idx - 1, idx + 1,
      ]
      for (const nidx of neighbors) {
        if (nidx < 0 || nidx >= tiles.length) continue
        const nt = tiles[nidx] & 0x7F
        if (!LAVA_IMMUNE.has(nt)) {
          tiles[nidx] = FIRE
          const nx = nidx % width
          const ny = nidx / width | 0
          world.markDirty(nx, ny)
          next.add(nidx)
        }
      }
    }

    const leftFirst = world.leftFirst
    const moved =
      world.tryMove(idx, tx, ty, tx,                         ty + 1, LAVA, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ? -1 :  1), ty + 1, LAVA, next) ||
      world.tryMove(idx, tx, ty, tx + (leftFirst ?  1 : -1), ty + 1, LAVA, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ? -1 :  1, next) ||
      world.tryFlowHorizontal(idx, tx, ty, leftFirst ?  1 : -1, next)

    if (!moved) {
      world.tiles[idx] = LAVA | SETTLED_FLAG
      world.markDirty(tx, ty)
    }
  },
}

export default def
