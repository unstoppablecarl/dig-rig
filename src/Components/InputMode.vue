<script setup lang="ts">
import type { Component } from 'vue'
import { InputMode } from '../game/lib/Input/_input.types.ts'
import { PlayerWeapon } from '../game/lib/Player/weapons.ts'
import { useUIState } from '../store/uiState.ts'
import { useWeaponUIState } from '../store/weaponUIState.ts'
import BrushInputMode from './InputMode/BrushInputMode.vue'
import WeaponInputMode from './InputMode/WeaponInputMode.vue'
import BasicWeaponComp from './InputMode/WeaponInputMode/BasicWeapon.vue'
import RapidWeaponComp from './InputMode/WeaponInputMode/RapidWeapon.vue'
import InstantWeaponComp from './InputMode/WeaponInputMode/InstantWeapon.vue'
import TorchWeaponComp from './InputMode/WeaponInputMode/TorchWeapon.vue'
import TunnelWeaponComp from './InputMode/WeaponInputMode/TunnelWeapon.vue'

const WEAPON_COMPONENTS: Record<PlayerWeapon, Component> = {
  [PlayerWeapon.BASIC]: BasicWeaponComp,
  [PlayerWeapon.RAPID]: RapidWeaponComp,
  [PlayerWeapon.INSTANT]: InstantWeaponComp,
  [PlayerWeapon.TORCH]: TorchWeaponComp,
  [PlayerWeapon.TUNNEL]: TunnelWeaponComp,
}

const uiState = useUIState()
const weaponUIState = useWeaponUIState()
</script>
<template>
  <div class="current-input-mode">
    <WeaponInputMode v-if="uiState.inputMode === InputMode.WEAPON">
      <component :is="WEAPON_COMPONENTS[weaponUIState.id]" />
    </WeaponInputMode>
    <BrushInputMode v-else-if="uiState.inputMode === InputMode.BRUSH" />
  </div>
</template>
