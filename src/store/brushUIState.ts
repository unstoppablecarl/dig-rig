import { defineStore, storeToRefs } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { computed, ref } from 'vue'
import { EMPTY, MatterType, setOwner, SupportType } from '../game/lib/Matter/_Matter.types.ts'
import {
  canHaveOwner,
  isAlwaysStructural as matterIsAlwaysStructural,
  isSupportTypeImmutable,
  setSupport,
} from '../game/lib/Matter/matter.ts'
import { PLAYER_MATTER_TANK_ID } from '../game/lib/Matter/Tank/_MatterTank.types.ts'

export type BrushUIState = ReturnType<typeof useBrushUIState>

type SerializedData = {
  primaryMatterType: MatterType
  primarySupportFlag: SupportType

  secondaryMatterType: MatterType
  secondarySupportFlag: SupportType
}

const BRUSH_RADIUS_MIN = 2
const BRUSH_RADIUS_MAX = 300

export const useBrushUIState = defineStore('brush-ui-state', () => {

  const { radius: _radius } = storeToRefs(usePrivateBrushRadius())

  const radius = computed({
    get: () => _radius.value,
    set: (val: number) => {
      _radius.value = Math.max(BRUSH_RADIUS_MIN, Math.min(BRUSH_RADIUS_MAX, val))
    },
  })

  const {
    matterType: primaryMatterType,
    isAlwaysStructural: primaryIsAlwaysStructural,
    supportFlag: primarySupportFlag,
    matterValue: primaryMatterValue,
  } = makeMatterPaint()

  const {
    matterType: secondaryMatterType,
    isAlwaysStructural: secondaryIsAlwaysStructural,
    supportFlag: secondarySupportFlag,
    matterValue: secondaryMatterValue,
  } = makeMatterPaint()

  const state = {
    primaryMatterType,
    primarySupportFlag,

    secondaryMatterType,
    secondarySupportFlag,
  }

  const defaults: SerializedData = {
    primaryMatterType: primaryMatterType.value,
    primarySupportFlag: primarySupportFlag.value,

    secondaryMatterType: secondaryMatterType.value,
    secondarySupportFlag: secondarySupportFlag.value,
  }

  const {
    $reset,
    $serializeState,
    $restoreState,
  } = makeSimplePersistMapper<SerializedData>(
    state,
    defaults,
  )

  return {
    $reset,
    $serializeState,
    $restoreState,

    radius,

    primaryMatterType,
    primarySupportFlag,

    secondaryMatterType,
    secondarySupportFlag,

    // readonly
    primaryMatterValue,
    primaryIsAlwaysStructural,

    secondaryMatterValue,
    secondaryIsAlwaysStructural,
  }
}, {
  persist: true,
})

function makeMatterPaint() {
  const matterType = ref<MatterType>(MatterType.SOLID)
  const supportFlag = ref<SupportType>(SupportType.NONE)

  const isAlwaysStructural = computed(() => matterIsAlwaysStructural(matterType.value))

  const matterValue = computed(() => {
    const type = matterType.value

    let value: number = type
    if (value !== EMPTY && !isSupportTypeImmutable(value)) {
      value = setSupport(value, supportFlag.value)
    }
    if (canHaveOwner(type)) {
      value = setOwner(value, PLAYER_MATTER_TANK_ID)
    }
    return value
  })

  return {
    matterType,
    isAlwaysStructural,
    supportFlag,
    matterValue,
  }
}

const usePrivateBrushRadius = defineStore('brush-radius', () => {
    const radius = ref(10)

    const {
      $reset,
      $serializeState,
      $restoreState,
    } = makeSimplePersistMapper(
      { radius },
      { radius: radius.value },
    )

    return {
      $reset,
      $serializeState,
      $restoreState,
      radius,
    }
  },
  {
    persist: true,
  })