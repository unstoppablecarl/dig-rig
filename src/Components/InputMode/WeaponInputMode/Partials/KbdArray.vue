<script setup lang="ts">
const { values } = defineProps<{
  values: string[]
}>()
</script>
<template>
  <template v-for="value in values">
    <kbd>{{ value }}</kbd>
  </template>
</template>