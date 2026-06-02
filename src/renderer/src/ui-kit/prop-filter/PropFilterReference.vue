<template>
  <PropEditReference
      :model-value="selectedValue"
      :reference-to="propertySchema.rules.referenceTo"
      nullable
      @update:model-value="handleChange"
  />
</template>

<script setup>
import { computed }      from 'vue'
import PropEditReference from '@/ui-kit/prop-edit/PropEditReference.vue'

const props = defineProps({
  propertySchema: { type: Object, required: true },
  modelValue: { type: Array, required: true },
})

const emit = defineEmits([ 'update:modelValue' ])

const selectedValue = computed(() =>
    props.modelValue.find(f => f.key === props.propertySchema.key && f.op === 'eq')?.value ?? null,
)

function handleChange (value) {
  if (value === null) emit('update:modelValue', [])
  else emit('update:modelValue', [ { key: props.propertySchema.key, op: 'eq', value } ])
}
</script>
