<template>
  <div class="prop-filter-boolean">
    <ui-button :hollow="selectedValue !== true" small @click="handleChange(true)">Yes</ui-button>
    <ui-button :hollow="selectedValue !== false" small @click="handleChange(false)">No</ui-button>
    <ui-button :hollow="selectedValue !== null" class="ui-secondary" small @click="handleChange(null)">Any</ui-button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  propertySchema: { type: Object, required: true },
  modelValue: { type: Array, required: true },
})

const emit = defineEmits([ 'update:modelValue' ])

const selectedValue = computed(() => {
  const f = props.modelValue.find(f => f.key === props.propertySchema.key && f.op === 'eq')
  return f ? f.value : null
})

function handleChange (value) {
  if (value === null) emit('update:modelValue', [])
  else emit('update:modelValue', [ { key: props.propertySchema.key, op: 'eq', value } ])
}
</script>

<style lang="scss" scoped>
.prop-filter-boolean {
  display: flex;
  gap: spacing(100);
}
</style>
