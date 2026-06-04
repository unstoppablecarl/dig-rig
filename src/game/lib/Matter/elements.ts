import {
  ACID,
  BURNING_THERMITE,
  C4,
  CHILLED_ICE,
  CONCRETE,
  CRYO,
  EMPTY,
  FALLING_WAX,
  FIRE,
  FUSE,
  GUNPOWDER,
  ICE,
  LAVA,
  type MatterType,
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
import { ACID_DEF } from './elements/acid.ts'
import { BURNING_THERMITE_DEF } from './elements/burning-thermite.ts'
import { C4_DEF } from './elements/c4.ts'
import { CHILLED_ICE_DEF } from './elements/chilled-ice.ts'
import { CONCRETE_DEF } from './elements/concrete.ts'
import { CRYO_DEF } from './elements/cryo.ts'
import { EMPTY_DEF } from './elements/empty.ts'
import { FALLING_WAX_DEF } from './elements/falling-wax.ts'
import { FIRE_DEF } from './elements/fire.ts'
import { FUSE_DEF } from './elements/fuse.ts'
import { GUNPOWDER_DEF } from './elements/gunpowder.ts'
import { ICE_DEF } from './elements/ice.ts'
import { LAVA_DEF } from './elements/lava.ts'
import { METHANE_DEF } from './elements/methane.ts'
import { NAPALM_DEF } from './elements/napalm.ts'
import { NITRO_DEF } from './elements/nitro.ts'
import { OIL_DEF } from './elements/oil.ts'
import { PERMANENT_DEF } from './elements/permanent.ts'
import { PLANT_DEF } from './elements/plant.ts'
import { ROCK_DEF } from './elements/rock.ts'
import { SALT_WATER_DEF } from './elements/salt-water.ts'
import { SALT_DEF } from './elements/salt.ts'
import { SAND_DEF } from './elements/sand.ts'
import { SOLID_DEF } from './elements/solid.ts'
import { STEAM_DEF } from './elements/steam.ts'
import { THERMITE_DEF } from './elements/thermite.ts'
import { WATER_DEF } from './elements/water.ts'
import { WAX_DEF } from './elements/wax.ts'
import type { MatterSim } from './MatterSim.ts'

export type ElementAction = (world: MatterSim, x: number, y: number, idx: number, next: Set<number>) => void

export type ElementDef = {
  name: string,
  action?: ElementAction,
  passive?: boolean,
  lavaImmune?: boolean,
  acidImmune?: boolean,
  liquid?: boolean,
  collidesWhenSettled?: boolean,
  sinksThrough?: MatterType[],
}

const noop = () => {
}

export const ELEMENT_ACTIONS: ElementAction[] = []
export const PASSIVE_ELEMENTS = new Set<MatterType>()
export const ELEMENT_NAMES = new Map<MatterType, string>()
export const LAVA_IMMUNE = new Set<MatterType>()
export const ACID_IMMUNE = new Set<MatterType>()
export const COLLIDES_WHEN_SETTLED = new Set<MatterType>()
export const LIQUID_TYPES = new Set<MatterType>()
export const SINKS_THROUGH: Partial<Record<MatterType, Set<MatterType>>> = {}

function add(id: MatterType, {
  name,
  action = noop,
  passive = false,
  lavaImmune = false,
  acidImmune = false,
  collidesWhenSettled = false,
  liquid = false,
  sinksThrough,
}: ElementDef) {
  ELEMENT_ACTIONS[id] = action
  ELEMENT_NAMES.set(id, name)

  if (passive) PASSIVE_ELEMENTS.add(id)
  if (lavaImmune) LAVA_IMMUNE.add(id)
  if (acidImmune) ACID_IMMUNE.add(id)
  if (liquid) LIQUID_TYPES.add(id)
  if (collidesWhenSettled) COLLIDES_WHEN_SETTLED.add(id)
  if (sinksThrough) SINKS_THROUGH[id] = new Set(sinksThrough)
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
