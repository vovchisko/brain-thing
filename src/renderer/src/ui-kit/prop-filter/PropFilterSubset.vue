<template>
  <PropEditSubset
      :model-value="selectedValues"
      :reference-to="propertySchema.rules.referenceTo"
      @update:model-value="handleChange"
  />
</template>

<script setup>
import { computed }   from 'vue'
import PropEditSubset from '@/ui-kit/prop-edit/PropEditSubset.vue'

const props = defineProps({
  propertySchema: { type: Object, required: true },
  modelValue: { type: Array, required: true },
})

const emit = defineEmits([ 'update:modelValue' ])

const selectedValues = computed(() =>
    props.modelValue.find(f => f.key === props.propertySchema.key && f.op === 'hasAny')?.value ?? [],
)

function handleChange (ids) {
  if (!ids?.length) emit('update:modelValue', [])
  else emit('update:modelValue', [ { key: props.propertySchema.key, op: 'hasAny', value: ids } ])
}
</script>
