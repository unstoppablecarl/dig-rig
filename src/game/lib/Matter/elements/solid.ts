import { SOLID } from '../_Matter-types.ts'
import type { ElementDef } from '../elements.ts'

const def: ElementDef = {
  id: SOLID,
  name: 'Solid',
  passive: true,
  // has small chance of lava hard coded
  lavaImmune: true,
}

export default def
