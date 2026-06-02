<template>
  <div class="prop-filter-date">
    <ui-datepicker-dropdown
        :model-value="fromValue ? new Date(fromValue) : null"
        :day-point="propertySchema.rules?.showTime ? null : 'start'"
        :show-time="propertySchema.rules?.showTime"
        nullable
        instant
        @update:model-value="handleFromChange"
    />

    <ui-datepicker-dropdown
        :model-value="toValue ? new Date(toValue) : null"
        :day-point="propertySchema.rules?.showTime ? null : 'end'"
        :show-time="propertySchema.rules?.showTime"
        nullable
        instant
        @update:model-value="handleToChange"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  propertySchema: { type: Object, required: true },
  modelValue: { type: Array, required: true },
})

const emit = defineEmits([ 'update:modelValue' ])

const fromValue = computed(() =>
  props.modelValue.find(f => f.key === props.propertySchema.key && f.op === 'gt')?.value ?? null
)

const toValue = computed(() =>
  props.modelValue.find(f => f.key === props.propertySchema.key && f.op === 'lt')?.value ?? null
)

function handleFromChange (value) {
  const filters = []

  if (value !== null) {
    filters.push({ key: props.propertySchema.key, op: 'gt', value: value.toISOString() })
  }

  if (toValue.value !== null) {
    filters.push({ key: props.propertySchema.key, op: 'lt', value: toValue.value })
  }

  emit('update:modelValue', filters)
}

function handleToChange (value) {
  const filters = []

  if (fromValue.value !== null) {
    filters.push({ key: props.propertySchema.key, op: 'gt', value: fromValue.value })
  }

  if (value !== null) {
    filters.push({ key: props.propertySchema.key, op: 'lt', value: value.toISOString() })
  }

  emit('update:modelValue', filters)
}
</script>

<style lang="scss" scoped>
.prop-filter-date {
  display: flex;
  flex-direction: column;
  gap: spacing(100);
}
</style>
