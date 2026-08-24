<script setup lang="ts">
import {
  type Binding,
  bindingLabels,
  PLAYER_ACTION_DISPLAY_NAME,
  PlayerAction,
} from '../game/lib/Input/PlayerActions.ts'
import { INPUT_ACTIONS } from '../input.ts'
import { useUIState } from '../store/uiState.ts'

const uiState = useUIState()

type PlayerActionDesc = {
  keys: Binding,
  mouseWheelModifier?: boolean,
  label: string,
}

function desc(key: PlayerAction): PlayerActionDesc {
  return {
    label: PLAYER_ACTION_DISPLAY_NAME[key],
    keys: INPUT_ACTIONS[key],
  }
}

const PLAYER_ACTION_GROUPS: Record<string, PlayerActionDesc[]> = {
  'Movement': [
    desc(PlayerAction.MOVE_LEFT),
    desc(PlayerAction.MOVE_RIGHT),
    desc(PlayerAction.JUMP),
  ],
  'Weapon': [
    desc(PlayerAction.FIRE_PRIMARY),
    desc(PlayerAction.FIRE_SECONDARY),
  ],
  'Weapon Specific': [
    desc(PlayerAction.PREV_MODE),
    desc(PlayerAction.NEXT_MODE),
    desc(PlayerAction.CHARGE_DECREASE),
    desc(PlayerAction.CHARGE_INCREASE),
    {
      keys: ['Mouse Wheel'],
      label: 'Charge: Change',
    },
    desc(PlayerAction.PREV_MATTER_TYPE),
    desc(PlayerAction.NEXT_MATTER_TYPE),
  ],
  'View': [
    {
      keys: INPUT_ACTIONS[PlayerAction.ZOOM_MOUSE_WHEEL_MODIFIER],
      mouseWheelModifier: true,
      label: 'Zoom',
    },
  ],
}

</script>

<template>
  <div class="help-modal" :class="{ show: uiState.helpModal }" @click.self="uiState.helpModal = false">
    <div class="help-panel">
      <div class="help-header">
        <span class="help-title">Controls</span>
        <button class="help-close" @click="uiState.helpModal = false">✕</button>
      </div>
      <div class="help-body">
        <template v-for="(items, heading) in PLAYER_ACTION_GROUPS">
          <div class="binding-heading">{{ heading }}</div>
          <div class="binding-row" v-for="{ label, keys, mouseWheelModifier } in items" :key="label">
            <span class="binding-label">{{ label }}</span>
            <span class="binding-keys">
              <template v-for="(key, i) in bindingLabels(keys)" :key="i">
                <span v-if="i > 0" class="key-sep">/</span>
                <kbd>{{ key }}</kbd>
              </template>
              <template v-if="mouseWheelModifier">
                <span v-if="mouseWheelModifier" class="modifier"> + </span>
                <kbd>Mouse Wheel</kbd>
              </template>
            </span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.help-modal {
  display: none;
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  cursor: pointer;
  z-index: 100;

  &.show {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.help-panel {
  cursor: default;
  background: #0e0e12;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.help-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.help-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.35);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  border-radius: 3px;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }
}

.help-body {
  padding: 8px 0 12px;
}

.binding-heading {
  padding: 12px 8px 6px;
  margin: 0 10px;
  font-size: 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  text-transform: uppercase;
  color: rgba(220, 220, 255, 0.5);

  &:first-child {
    padding-top: 6px;
  }
}

.binding-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 18px;
  gap: 16px;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }
}

.binding-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.66);
  white-space: nowrap;
}

.binding-keys {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.modifier {
  padding: 0 3px 5px;
}

.key-sep {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.2);
  margin: 0 1px;
}
</style>
