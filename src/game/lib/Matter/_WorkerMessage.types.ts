export enum CoordinatorInMsg {
  INIT = 0,
  ACTIVATE = 1,
  CHECK = 2,
  WRITE = 3,
  APPLY_EFFECT = 4,
}

export enum SimInMsg {
  INIT = 5,
  PROCESS = 6,
}

export enum CoordinatorOutMsg {
  SETTLED = 0,
  SPAWN_PARTICLE = 1,
  TRANSFER_TO_MATTER_TANKS = 2,
  APPLY_EFFECT_RESULT = 3,
}

export enum SimOutMsg {
  READY = 4,
  DONE = 5,
}