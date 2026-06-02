<template>
  <span>{{ displayValue }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: Array,
    default: () => [],
  },
})

const displayValue = computed(() => {
  if (!Array.isArray(props.value) || props.value.length === 0) {
    return '-'
  }
  return props.value.join('; ')
})
</script>
