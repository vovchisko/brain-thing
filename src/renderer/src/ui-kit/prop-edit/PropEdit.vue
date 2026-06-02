<template>
  <PropEditEnum
      v-if="propertySchema.type === TYPES.ENUM"
      :model-value="modelValue"
      :property-schema="propertySchema"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <ui-input
      v-else-if="propertySchema.format === FORMATS.TEXT"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <ui-textarea
      v-else-if="propertySchema.format === FORMATS.TEXTAREA"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <ui-check
      v-else-if="propertySchema.format === FORMATS.CHECKBOX"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <ui-datepicker-dropdown
      v-else-if="propertySchema.format === FORMATS.DATEPICKER"
      :model-value="modelValue ? new Date(modelValue) : null"
      :day-point="propertySchema.rules?.dayPoint"
      :show-time="propertySchema.rules?.showTime"
      :nullable="propertySchema.nullable"
      instant
      @update:model-value="emit('update:modelValue', $event ? $event.toISOString() : null)"
  />

  <PropEditSelect
      v-else-if="propertySchema.format === FORMATS.SELECT"
      :model-value="modelValue"
      :options="propertySchema.rules.options"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <PropEditReference
      v-else-if="propertySchema.type === TYPES.REFERENCE"
      :model-value="modelValue"
      :reference-to="propertySchema.rules.referenceTo"
      :nullable="propertySchema.nullable"
      :exclude-id="excludeId"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <PropEditSubset
      v-else-if="propertySchema.type === TYPES.SUBSET"
      :model-value="modelValue"
      :reference-to="propertySchema.rules.referenceTo"
      :exclude-id="excludeId"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <PropEditArray
      v-else-if="propertySchema.type === TYPES.ARRAY"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <div v-else class="prop-edit_unsupported">
    Unsupported type: {{ propertySchema.type }} / format: {{ propertySchema.format }}
  </div>
</template>

<script setup>
import { FORMATS, TYPES } from '@shared/dictionary.js'
import PropEditEnum       from './PropEditEnum.vue'
import PropEditReference  from './PropEditReference.vue'
import PropEditSubset     from './PropEditSubset.vue'
import PropEditSelect     from './PropEditSelect.vue'
import PropEditArray      from './PropEditArray.vue'

defineProps({
  propertySchema: { type: Object, required: true },
  modelValue: { required: true },
  excludeId: { type: String, default: null },   // hide this id from same-collection ref/subset pickers (no self-loop)
})

const emit = defineEmits([ 'update:modelValue' ])
</script>

<style lang="scss" scoped>
.prop-edit_unsupported {
  padding: spacing(200);
  background: var(--negative);
  color: var(--text);
  border-radius: var(--radius-md);
}
</style>
