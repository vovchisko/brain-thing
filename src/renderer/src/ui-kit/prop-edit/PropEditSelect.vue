<template>
  <ui-dropdown :auto-scroll="false" class="prop-edit-select">
    <template #default="{ isOpen }">
      <ui-button class="prop-edit-select_trigger" hollow>
        {{ displayValue }}
        <ui-icon :name="isOpen ? ICON.CHEVRON_UP : ICON.CHEVRON_DOWN" />
      </ui-button>
    </template>

    <template #content="{ dropdownClose }">
      <div class="prop-edit-select_list">
        <ui-dropdown-item
            v-for="option in normalizedOptions"
            :key="option.value"
            :active="option.value === modelValue"
            auto-close
            interactive
            @click="selectItem(option.value, dropdownClose)"
        >
          {{ option.label }}
        </ui-dropdown-item>
      </div>
    </template>
  </ui-dropdown>
</template>

<script setup>
import { computed }   from 'vue'
import UiDropdown     from '@/ui-kit/atmos/UiDropdown.vue'
import UiDropdownItem from '@/ui-kit/atmos/UiDropdownItem.vue'
import UiButton       from '@/ui-kit/atmos/UiButton.vue'
import UiIcon         from '@/ui-kit/atmos/UiIcon.vue'
import { ICON }       from '@/ui-kit/atmos/UiIconParts/icon-names.js'

const props = defineProps({
  modelValue: { type: String, default: null },
  options: { type: Array, required: true },
})

const emit = defineEmits([ 'update:modelValue' ])

const normalizedOptions = computed(() =>
    props.options.map(o => (typeof o === 'string' ? { value: o, label: o } : o)),
)

const displayValue = computed(() => {
  if (!props.modelValue) return '(not selected)'
  const found = normalizedOptions.value.find(o => o.value === props.modelValue)
  return found?.label || props.modelValue
})

function selectItem (value, dropdownClose) {
  emit('update:modelValue', value)
  dropdownClose()
}
</script>

<style lang="scss" scoped>
.prop-edit-select {
  display: flex;
  flex: 1;

  &_trigger {
    flex: 1;
    justify-content: space-between;
    --ui-pal: var(--ui-pal-lateral);
    background: var(--bg-input) !important;
    color: var(--text) !important;
  }

  &_list { min-width: var(--ui-dropdown-trigger-width); padding: spacing(200); }
}
</style>
