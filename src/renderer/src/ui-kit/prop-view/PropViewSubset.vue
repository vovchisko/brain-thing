<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { refs }     from '@/dataset/modules/data.js'

const props = defineProps({
  value: { type: Array, default: () => [] },
  referenceTo: { type: String, required: true },
})

const display = computed(() => {
  if (!props.value || props.value.length === 0) return '-'
  const bucket = refs.get(props.referenceTo)
  return props.value
      .map(id => bucket?.get(id)?.label ?? `? ${ id }`)
      .join(', ')
})
</script>
