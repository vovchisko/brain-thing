<template>
  <div class="prop-filter-enum">
    <ui-check
        v-for="option in normalizedOptions"
        :key="option.value"
        :model-value="selectedValues.includes(option.value)"
        @update:model-value="handleChange(option.value, $event)"
    >
      {{ option.label }}
    </ui-check>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  propertySchema: { type: Object, required: true },
  modelValue: { type: Array, required: true },
})

const emit = defineEmits([ 'update:modelValue' ])

const normalizedOptions = computed(() => {
  const opts = props.propertySchema.rules?.options || []
  return opts.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
})

const selectedValues = computed(() =>
    props.modelValue.find(f => f.key === props.propertySchema.key && f.op === 'in')?.value ?? [],
)

function handleChange (value, checked) {
  const current = [ ...selectedValues.value ]
  if (checked) {
    if (!current.includes(value)) current.push(value)
  } else {
    const idx = current.indexOf(value)
    if (idx !== -1) current.splice(idx, 1)
  }
  if (current.length === 0) emit('update:modelValue', [])
  else emit('update:modelValue', [ { key: props.propertySchema.key, op: 'in', value: current } ])
}
</script>

<style lang="scss" scoped>
.prop-filter-enum {
  display: flex;
  flex-direction: column;
  gap: spacing(100);
}
</style>
