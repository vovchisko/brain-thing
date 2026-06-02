<template>
  <div class="filter-sidebar">
    <ui-button :hollow="!hasActiveFilters" small @click="isOpen = true">
      <ui-icon :name="ICON.FILTER" />
    </ui-button>

    <ui-modal :is-open="isOpen" sidebar @close="isOpen = false">
      <template #header>Filters</template>

      <div class="filter-sidebar_content">
        <div class="filter-sidebar_header">
          <div class="filter-sidebar_count">{{ itemCountText }}</div>
          <ui-button-link v-if="hasActiveFilters" @click="clearAllFilters">Clear all</ui-button-link>
        </div>

        <div class="filter-sidebar_fields">
          <div v-for="prop in filterProps" :key="prop.key" class="filter-sidebar_field">
            <label>{{ prop.key }}</label>
            <prop-filter
                v-model="internalFilters[prop.key]"
                :property-schema="prop"
            />
          </div>
        </div>
      </div>
    </ui-modal>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

import { ICON }     from '@/ui-kit/atmos/UiIconParts/icon-names.js'
import PropFilter   from '@/ui-kit/prop-filter/PropFilter.vue'
import UiButton     from '@/ui-kit/atmos/UiButton.vue'
import UiButtonLink from '@/ui-kit/atmos/UiButtonLink.vue'
import UiIcon       from '@/ui-kit/atmos/UiIcon.vue'
import UiModal      from '@/ui-kit/atmos/UiModal.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  schema: { type: Object, required: true },
  filterableFields: { type: Array, required: true },
  store: { type: Object, default: null },
})

const emit = defineEmits([ 'update:modelValue', 'sidebarOpen', 'sidebarClose' ])

const isOpen = ref(false)

watch(isOpen, (nowOpen) => emit(nowOpen ? 'sidebarOpen' : 'sidebarClose'))

const filterProps = computed(() => {
  return props.filterableFields.map(field => {
    const original = props.schema.props.find(p => p.key === field.key)
    if (!original) throw new Error(`Field "${ field.key }" not found in schema`)
    return { ...original, label: field.label || original.label }
  })
})

const internalFilters = reactive(
    Object.fromEntries(props.filterableFields.map(field => [ field.key, [] ])),
)

const hasActiveFilters = computed(() => Object.values(internalFilters).some(arr => arr?.length > 0))

const itemCountText = computed(() => {
  if (!props.store) return ''
  const total = props.store.total ?? 0
  return `${ total } items`
})

watch(internalFilters, () => {
  const filters = Object.values(internalFilters).filter(arr => arr?.length > 0).flat()
  emit('update:modelValue', filters)
}, { deep: true })

function clearAllFilters () {
  Object.keys(internalFilters).forEach(key => (internalFilters[key] = []))
}
</script>

<style lang="scss" scoped>
.filter-sidebar {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: spacing(100);

  &_content {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding-bottom: spacing(500);
  }

  &_header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: spacing(300);
    margin-bottom: spacing(300);
    border-bottom: 1px solid var(--border);
  }

  &_count {
    font-size: var(--font-label);
    color: var(--text-soft);
  }

  &_fields {
    display: flex;
    flex-direction: column;
    gap: spacing(500);
  }

  &_field {
    display: flex;
    flex-direction: column;
    gap: spacing(100);

    label {
      font-size: var(--font-ui);
      font-weight: 500;
      color: var(--text-soft);
    }
  }
}
</style>
