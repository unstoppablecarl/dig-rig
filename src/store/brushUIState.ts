import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { computed, ref } from 'vue'
import { ALWAYS_STRUCTURAL, setStructural } from '../game/lib/Matter/_Matter-meta.ts'
import { EMPTY, MatterType, setAnchored, setOwner } from '../game/lib/Matter/_Matter.types.ts'
import { PLAYER_MATTER_TANK_ID } from '../game/lib/Matter/MatterTank/_MatterTank.types.ts'

export type BrushUIState = ReturnType<typeof useBrushUIState>

type SerializedData = {
  radius: number

  primaryMatterType: MatterType
  primaryStructuralFlag: boolean
  primaryAnchoredFlag: boolean

  secondaryMatterType: MatterType
  secondaryStructuralFlag: boolean
  secondaryAnchoredFlag: boolean
}

const BRUSH_RADIUS_MIN = 10
const BRUSH_RADIUS_MAX = 30

export const useBrushUIState = defineStore('brush-ui-state', () => {
  const _radius = ref(10)

  const radius = computed({
    get: () => _radius.value,
    set: (val: number) => {
      _radius.value = Math.max(BRUSH_RADIUS_MIN, Math.min(BRUSH_RADIUS_MAX, val))
    },
  })

  const {
    matterType: primaryMatterType,
    isAlwaysStructural: primaryIsAlwaysStructural,
    structuralFlag: primaryStructuralFlag,
    anchoredFlag: primaryAnchoredFlag,
    matterValue: primaryMatterValue,
  } = makeMatterPaint()

  const {
    matterType: secondaryMatterType,
    isAlwaysStructural: secondaryIsAlwaysStructural,
    structuralFlag: secondaryStructuralFlag,
    anchoredFlag: secondaryAnchoredFlag,
    matterValue: secondaryMatterValue,
  } = makeMatterPaint()

  const state = {
    radius,

    primaryMatterType,
    primaryStructuralFlag,
    primaryAnchoredFlag,
    primaryMatterValue,

    secondaryMatterType,
    secondaryStructuralFlag,
    secondaryAnchoredFlag,
    secondaryMatterValue,
  }

  const defaults: SerializedData = {
    radius: radius.value,

    primaryMatterType: primaryMatterType.value,
    primaryStructuralFlag: primaryStructuralFlag.value,
    primaryAnchoredFlag: primaryAnchoredFlag.value,

    secondaryMatterType: secondaryMatterType.value,
    secondaryStructuralFlag: secondaryStructuralFlag.value,
    secondaryAnchoredFlag: secondaryAnchoredFlag.value,
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
    primaryStructuralFlag,
    primaryAnchoredFlag,

    secondaryMatterType,
    secondaryStructuralFlag,
    secondaryAnchoredFlag,

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
  const structuralFlag = ref(false)
  const anchoredFlag = ref(false)

  const isAlwaysStructural = computed(() => ALWAYS_STRUCTURAL.has(matterType.value))

  const matterValue = computed(() => {
    let value: number = matterType.value
    if (value !== EMPTY && !isAlwaysStructural.value && structuralFlag.value) {
      value = setStructural(value, true)
    }
    value = setAnchored(value, anchoredFlag.value)
    value = setOwner(value, PLAYER_MATTER_TANK_ID)

    return value
  })
  return {
    matterType,
    isAlwaysStructural,
    structuralFlag,
    anchoredFlag,
    matterValue,
  }
}