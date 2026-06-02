<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { refs }     from '@/dataset/modules/data.js'

const props = defineProps({
  value: { type: String, default: null },
  referenceTo: { type: String, required: true },
})

const display = computed(() => {
  if (!props.value) return '-'
  const ref = refs.get(props.referenceTo)?.get(props.value)
  return ref?.label ?? `? ${ props.value }`
})
</script>
