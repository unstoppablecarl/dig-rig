<script setup lang="ts">
import { PLAYER_ACTION_LABELS } from '../game/lib/Input/PlayerActions.ts'
import { INPUT_ACTIONS } from '../input.ts'
import { useUIState } from '../store/uiState.ts'

const uiState = useUIState()

const KEYCODE_NAMES: Record<number, string> = {
  32: 'Space',
  37: '←',
  38: '↑',
  39: '→',
  40: '↓',
}

function formatKey(key: string | number): string {
  if (typeof key === 'number') return KEYCODE_NAMES[key] ?? `${key}`
  const aliases: Record<string, string> = { SHIFT: 'Shift' }
  return aliases[key] ?? (key.length === 1 ? key.toUpperCase() : key)
}

const bindings = Object.entries(INPUT_ACTIONS).map(([action, keys]) => ({
  label: PLAYER_ACTION_LABELS[action] ?? action,
  keys: keys as (string | number)[],
}))
</script>

<template>
  <div class="help-modal" :class="{ show: uiState.helpModal }" @click.self="uiState.helpModal = false">
    <div class="help-panel">
      <div class="help-header">
        <span class="help-title">Controls</span>
        <button class="help-close" @click="uiState.helpModal = false">✕</button>
      </div>
      <div class="help-body">
        <div class="binding-row" v-for="{ label, keys } in bindings" :key="label">
          <span class="binding-label">{{ label }}</span>
          <span class="binding-keys">
            <template v-for="(key, i) in keys" :key="i">
              <span v-if="i > 0" class="key-sep">/</span>
              <kbd>{{ formatKey(key) }}</kbd>
            </template>
          </span>
        </div>
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
  color: rgba(255, 255, 255, 0.5);
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
  color: rgba(255, 255, 255, 0.75);
  white-space: nowrap;
}

.binding-keys {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.key-sep {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.2);
  margin: 0 1px;
}

</style>
