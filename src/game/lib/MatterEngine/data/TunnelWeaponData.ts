import { makeStructFactory } from '../../Util/Struct.ts'

export type TunnelWeaponDataType = ReturnType<typeof TunnelWeaponData.make>
export const TunnelWeaponData = makeStructFactory({
  destroyActive: Float32Array,
  destroyX: Float32Array,
  destroyY: Float32Array,
  destroyRadius: Float32Array,

  playerX: Float32Array,
  playerY: Float32Array,
  playerDirX: Float32Array,
  playerDirY: Float32Array,
})
