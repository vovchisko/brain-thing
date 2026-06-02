<template>
  <ui-input
      :model-value="searchValue"
      @update:model-value="handleChange"
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  propertySchema: { type: Object, required: true },
  modelValue: { type: Array, required: true },
})

const emit = defineEmits([ 'update:modelValue' ])

const searchValue = computed(() =>
  props.modelValue.find(f => f.key === props.propertySchema.key && f.op === 'contains')?.value ?? ''
)

function handleChange (value) {
  if (!value || value.trim() === '') {
    emit('update:modelValue', [])
  } else {
    emit('update:modelValue', [
      { key: props.propertySchema.key, op: 'contains', value },
    ])
  }
}
</script>
