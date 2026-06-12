import { defineStore } from 'pinia'
import { makeSimplePersistMapper } from 'pinia-simple-persist'
import { computed, ref, watch } from 'vue'
import { MatterType } from '../game/lib/Matter/_Matter-types.ts'

export type BrushUIState = ReturnType<typeof useBrushUIState>

type SerializedData = {
  radius: number
  primaryMatterType: MatterType
  secondaryMatterType: MatterType
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

  const primaryMatterType = ref<MatterType>(MatterType.SOLID)
  const secondaryMatterType = ref<MatterType>(MatterType.FIRE)

  const state = {
    radius,
    primaryMatterType,
    secondaryMatterType,
  }

  const defaults: SerializedData = {
    radius: radius.value,
    primaryMatterType: primaryMatterType.value,
    secondaryMatterType: secondaryMatterType.value,
  }

  const {
    $reset,
    $serializeState,
    $restoreState,
  } = makeSimplePersistMapper<SerializedData>(
    state,
    defaults,
  )

  function watchRadius(cb: (radius: number) => void) {
    return watch(radius, cb, { immediate: true, flush: 'sync' })
  }

  return {
    $reset,
    $serializeState,
    $restoreState,
    radius,
    primaryMatterType,
    secondaryMatterType,
    watchRadius,
  }
}, {
  persist: true,
})

