<template>
  <PropViewEnum
      v-if="propertySchema.type === TYPES.ENUM"
      :property-schema="propertySchema"
      :value="value"
  />
  <PropViewReference
      v-else-if="propertySchema.type === TYPES.REFERENCE"
      :reference-to="propertySchema.rules.referenceTo"
      :value="value"
  />
  <PropViewSubset
      v-else-if="propertySchema.type === TYPES.SUBSET"
      :reference-to="propertySchema.rules.referenceTo"
      :value="value"
  />
  <PropViewSelect
      v-else-if="propertySchema.format === FORMATS.SELECT"
      :model-value="value"
      :options="propertySchema.rules.options"
  />
  <PropViewArray v-else-if="propertySchema.type === TYPES.ARRAY" :value="value" />
  <span v-else>{{ formattedValue }}</span>
</template>

<script setup>
import { computed }       from 'vue'
import { FORMATS, TYPES } from '@shared/dictionary.js'
import PropViewEnum       from './PropViewEnum.vue'
import PropViewArray      from './PropViewArray.vue'
import PropViewReference  from './PropViewReference.vue'
import PropViewSubset     from './PropViewSubset.vue'
import PropViewSelect     from './PropViewSelect.vue'

const props = defineProps({
  propertySchema: { type: Object, required: true },
  value: { required: true },
})

const formattedValue = computed(() => {
  if (props.value === null || props.value === undefined) return '-'
  switch (props.propertySchema.type) {
    case TYPES.DATE:
      return new Date(props.value).toLocaleString()
    case TYPES.BOOLEAN:
      return props.value ? 'Yes' : 'No'
    default:
      return String(props.value)
  }
})
</script>
