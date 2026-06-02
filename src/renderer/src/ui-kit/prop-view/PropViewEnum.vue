<template>
  <span class="prop-view-enum">{{ displayValue }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  propertySchema: { type: Object, required: true },
  value: { type: String, default: null },
})

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return '—'
  const opts = props.propertySchema.rules?.options || []
  // options can be either string[] or [{value,label}]
  const found = opts.find(o => o === props.value || o?.value === props.value)
  if (typeof found === 'string') return found
  return found?.label || props.value
})
</script>

<style lang="scss" scoped>
.prop-view-enum {
  display: inline-block;
}
</style>
