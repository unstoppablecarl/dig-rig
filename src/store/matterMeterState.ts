import { ref } from 'vue'

export const matterMeterState = {
  visible: ref(false),
  fillPercent: ref(0),
  matterText: ref(''),
  reservedDestroyPercent: ref(0),
  pendingDestroyPercent: ref(0),
  pendingCreatePercent: ref(0),
  destroyChargePercent: ref(0),
  createChargePercent: ref(0),
}
