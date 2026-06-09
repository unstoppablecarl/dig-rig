import {
  ACID_IMMUNE,
  COLLIDES_WHEN_SETTLED,
  LAVA_IMMUNE,
  LIQUID_TYPES,
  PASSIVE_MATER_TYPES,
  SINKS_THROUGH,
} from './_Matter-meta'
import {
  ACID,
  BURNING_THERMITE,
  C4,
  CHILLED_ICE,
  CONCRETE,
  CRYO,
  type MatterDef,
  EMPTY,
  FALLING_WAX,
  FIRE,
  FUSE,
  GUNPOWDER,
  ICE,
  LAVA,
  type MatterType,
  MatterTypeSet,
  METHANE,
  NAPALM,
  NITRO,
  OIL,
  PERMANENT,
  PLANT,
  ROCK,
  SALT,
  SALT_WATER,
  SAND,
  SOLID,
  STEAM,
  THERMITE,
  WATER,
  WAX,
} from './_Matter-types.ts'
import { ACID_DEF } from './defs/acid.ts'
import { BURNING_THERMITE_DEF } from './defs/burning-thermite.ts'
import { C4_DEF } from './defs/c4.ts'
import { CHILLED_ICE_DEF } from './defs/chilled-ice.ts'
import { CONCRETE_DEF } from './defs/concrete.ts'
import { CRYO_DEF } from './defs/cryo.ts'
import { EMPTY_DEF } from './defs/empty.ts'
import { FALLING_WAX_DEF } from './defs/falling-wax.ts'
import { FIRE_DEF } from './defs/fire.ts'
import { FUSE_DEF } from './defs/fuse.ts'
import { GUNPOWDER_DEF } from './defs/gunpowder.ts'
import { ICE_DEF } from './defs/ice.ts'
import { LAVA_DEF } from './defs/lava.ts'
import { METHANE_DEF } from './defs/methane.ts'
import { NAPALM_DEF } from './defs/napalm.ts'
import { NITRO_DEF } from './defs/nitro.ts'
import { OIL_DEF } from './defs/oil.ts'
import { PERMANENT_DEF } from './defs/permanent.ts'
import { PLANT_DEF } from './defs/plant.ts'
import { ROCK_DEF } from './defs/rock.ts'
import { SALT_WATER_DEF } from './defs/salt-water.ts'
import { SALT_DEF } from './defs/salt.ts'
import { SAND_DEF } from './defs/sand.ts'
import { SOLID_DEF } from './defs/solid.ts'
import { STEAM_DEF } from './defs/steam.ts'
import { THERMITE_DEF } from './defs/thermite.ts'
import { WATER_DEF } from './defs/water.ts'
import { WAX_DEF } from './defs/wax.ts'
import type { MatterSim } from './MatterSim.ts'

export type MatterAction = (world: MatterSim, x: number, y: number, idx: number, next: Set<number>) => void

const noop = () => {
}

export const MATTER_ACTIONS: MatterAction[] = []
export const MATTER_NAMES = new Map<MatterType, string>()

function add(id: MatterType, {
  name,
  action = noop,
  passive = false,
  lavaImmune = false,
  acidImmune = false,
  collidesWhenSettled = false,
  liquid = false,
  sinksThrough,
}: MatterDef) {
  MATTER_ACTIONS[id] = action
  MATTER_NAMES.set(id, name)

  if (passive) PASSIVE_MATER_TYPES.add(id)
  if (lavaImmune) LAVA_IMMUNE.add(id)
  if (acidImmune) ACID_IMMUNE.add(id)
  if (liquid) LIQUID_TYPES.add(id)
  if (collidesWhenSettled) COLLIDES_WHEN_SETTLED.add(id)
  if (sinksThrough) SINKS_THROUGH[id] = new MatterTypeSet(...sinksThrough)
}

add(EMPTY, EMPTY_DEF)
add(SOLID, SOLID_DEF)
add(PERMANENT, PERMANENT_DEF)
add(SAND, SAND_DEF)
add(WATER, WATER_DEF)
add(FIRE, FIRE_DEF)
add(OIL, OIL_DEF)
add(LAVA, LAVA_DEF)
add(ROCK, ROCK_DEF)
add(STEAM, STEAM_DEF)
add(METHANE, METHANE_DEF)
add(SALT, SALT_DEF)
add(SALT_WATER, SALT_WATER_DEF)
add(CONCRETE, CONCRETE_DEF)
add(PLANT, PLANT_DEF)
add(FUSE, FUSE_DEF)
add(WAX, WAX_DEF)
add(FALLING_WAX, FALLING_WAX_DEF)
add(NITRO, NITRO_DEF)
add(NAPALM, NAPALM_DEF)
add(C4, C4_DEF)
add(ICE, ICE_DEF)
add(CHILLED_ICE, CHILLED_ICE_DEF)
add(CRYO, CRYO_DEF)
add(ACID, ACID_DEF)
add(THERMITE, THERMITE_DEF)
add(BURNING_THERMITE, BURNING_THERMITE_DEF)
add(GUNPOWDER, GUNPOWDER_DEF)
