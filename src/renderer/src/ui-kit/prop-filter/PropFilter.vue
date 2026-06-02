<template>
  <PropFilterEnum
      v-if="propertySchema.type === TYPES.ENUM"
      :model-value="modelValue"
      :property-schema="propertySchema"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <PropFilterBoolean
      v-else-if="propertySchema.type === TYPES.BOOLEAN"
      :model-value="modelValue"
      :property-schema="propertySchema"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <PropFilterText
      v-else-if="propertySchema.format === FORMATS.TEXT || propertySchema.format === FORMATS.TEXTAREA"
      :model-value="modelValue"
      :property-schema="propertySchema"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <PropFilterReference
      v-else-if="propertySchema.type === TYPES.REFERENCE"
      :model-value="modelValue"
      :property-schema="propertySchema"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <PropFilterSubset
      v-else-if="propertySchema.type === TYPES.SUBSET"
      :model-value="modelValue"
      :property-schema="propertySchema"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <PropFilterDate
      v-else-if="propertySchema.format === FORMATS.DATEPICKER"
      :model-value="modelValue"
      :property-schema="propertySchema"
      @update:model-value="emit('update:modelValue', $event)"
  />

  <div v-else class="prop-filter_unsupported">
    Unsupported filter: {{ propertySchema.type }} / {{ propertySchema.format }}
  </div>
</template>

<script setup>
import { FORMATS, TYPES }  from '@shared/dictionary.js'
import PropFilterEnum      from './PropFilterEnum.vue'
import PropFilterBoolean   from './PropFilterBoolean.vue'
import PropFilterText      from './PropFilterText.vue'
import PropFilterReference from './PropFilterReference.vue'
import PropFilterSubset    from './PropFilterSubset.vue'
import PropFilterDate      from './PropFilterDate.vue'

defineProps({
  propertySchema: { type: Object, required: true },
  modelValue: { type: Array, required: true },
})

const emit = defineEmits([ 'update:modelValue' ])
</script>

<style lang="scss" scoped>
.prop-filter_unsupported {
  padding: spacing(200);
  background: var(--negative);
  color: var(--text);
  border-radius: var(--radius-md);
}
</style>
