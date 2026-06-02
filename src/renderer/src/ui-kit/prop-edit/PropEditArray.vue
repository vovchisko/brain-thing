<template>
  <div class="prop-edit-array">
    <div v-for="(item, index) in modelValue" :key="index" class="prop-edit-array_item">
      <ui-input :model-value="item" @update:model-value="updateItem(index, $event)" />
      <ui-button hollow class="ui-negative" small @click="removeItem(index)">
        <ui-icon :name="ICON.CROSS" />
      </ui-button>
    </div>
    <ui-button @click="addItem">Add</ui-button>
  </div>
</template>

<script setup>
import { ICON } from '@/ui-kit/atmos/UiIconParts/icon-names.js'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([ 'update:modelValue' ])

function updateItem (index, value) {
  const updated = [ ...props.modelValue ]
  updated[index] = value
  emit('update:modelValue', updated)
}

function addItem () {
  emit('update:modelValue', [ ...props.modelValue, '' ])
}

function removeItem (index) {
  const updated = [ ...props.modelValue ]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}
</script>

<style lang="scss" scoped>
.prop-edit-array {
  display: flex;
  flex-direction: column;
  gap: spacing(200);

  &_item {
    display: flex;
    gap: spacing(200);
  }
}
</style>

