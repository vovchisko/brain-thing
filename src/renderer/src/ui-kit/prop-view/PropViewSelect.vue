<template>
  <span class="prop-view-select">{{ displayValue }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: null },
  options: { type: Array, required: true },
})

const displayValue = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined) return '—'
  const found = props.options.find(o => o === props.modelValue || o?.value === props.modelValue)
  if (typeof found === 'string') return found
  return found?.label || props.modelValue
})
</script>

<style lang="scss" scoped>
.prop-view-select {
  display: inline-block;
  padding: spacing(100, 200);
}
</style>
