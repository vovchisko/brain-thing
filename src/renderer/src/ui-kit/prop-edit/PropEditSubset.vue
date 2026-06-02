<template>
  <ui-dropdown :auto-scroll="false" class="prop-edit-subset" @open="picker.open" @close="picker.close">
    <template #default="{ isOpen }">
      <ui-button class="prop-edit-subset_trigger" hollow :title="selectedLabels.join(', ')">
        <span class="prop-edit-subset_trigger-text">{{ triggerText }}</span>
        <ui-icon :name="isOpen ? ICON.CHEVRON_UP : ICON.CHEVRON_DOWN" />
      </ui-button>
    </template>

    <template #content>
      <div class="prop-edit-subset_content">
        <div class="prop-edit-subset_search">
          <ui-input v-model="picker.search.value" auto-focus placeholder="Search...">
            <template #right>
              <ui-icon
                  v-if="picker.search.value"
                  :name="ICON.CROSS"
                  class="prop-edit-subset_search-clear"
                  @click="picker.search.value = ''"
              />
            </template>
          </ui-input>
        </div>

        <div ref="listRef" class="prop-edit-subset_list" @scroll="onScroll">
          <label v-for="item in options" :key="item.id" class="prop-edit-subset_item">
            <ui-check :model-value="isSelected(item.id)" @update:model-value="toggle(item.id)">
              {{ schemas.displayLabel(item, picker.targetSchema.value) }}
            </ui-check>
          </label>

          <div v-if="picker.loading.value" class="prop-edit-subset_status">Loading…</div>
          <div v-else-if="!options.length" class="prop-edit-subset_status">No items.</div>
          <div v-else-if="!picker.hasMore.value" class="prop-edit-subset_status">— end —</div>
        </div>
      </div>
    </template>
  </ui-dropdown>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRefPicker }  from '@/composables/useRefPicker.js'
import { schemas }       from '@/dataset/modules/schemas.js'
import UiDropdown        from '@/ui-kit/atmos/UiDropdown.vue'
import UiButton          from '@/ui-kit/atmos/UiButton.vue'
import UiInput           from '@/ui-kit/atmos/UiInput.vue'
import UiIcon            from '@/ui-kit/atmos/UiIcon.vue'
import { ICON }          from '@/ui-kit/atmos/UiIconParts/icon-names.js'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  referenceTo: { type: String, required: true },
  excludeId: { type: String, default: null },   // the editing row's own id — never offer it (no self-loop)
})

const emit = defineEmits([ 'update:modelValue' ])

const picker = useRefPicker(props.referenceTo)
const listRef = ref(null)

const options = computed(() => props.excludeId ? picker.options.filter(o => o.id !== props.excludeId) : picker.options)

const selectedLabels = computed(() => props.modelValue.map(id => picker.labelFor(id) || `? ${ id }`))

const triggerText = computed(() => {
  if (!props.modelValue.length) return '— None —'
  if (props.modelValue.length <= 2) return selectedLabels.value.join(', ')
  return `${ props.modelValue.length } selected`
})

function isSelected (id) {
  return props.modelValue.includes(id)
}

function toggle (id) {
  const next = [ ...props.modelValue ]
  const idx = next.indexOf(id)
  if (idx > -1) next.splice(idx, 1)
  else next.push(id)
  emit('update:modelValue', next)
}

function onScroll (e) {
  const el = e.target
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) picker.loadMore()
}
</script>

<style lang="scss" scoped>
.prop-edit-subset {
  display: flex;
  flex: 1;

  &_trigger {
    flex: 1;
    min-width: 0;
    justify-content: space-between;
    --ui-pal: var(--ui-pal-lateral);
    background: var(--bg-input) !important;
    color: var(--text) !important;

    &-text {
      flex: 1;
      min-width: 0;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &_content { min-width: var(--ui-dropdown-trigger-width); }

  &_search {
    padding: spacing(200);

    &-clear {
      --icon-size: 16px;
      cursor: pointer;
      margin-right: spacing(200);
      color: var(--ui-pal-lateral);

      &:hover { color: var(--text); }
    }
  }

  &_list {
    min-width: var(--ui-dropdown-trigger-width);
    max-height: 300px;
    overflow-y: auto;
    padding: spacing(200);
    display: flex;
    flex-direction: column;
    gap: spacing(100);
    @include scroll-styled();
  }

  &_item { display: flex; align-items: center; }

  &_status {
    padding: spacing(200, 400);
    color: var(--ui-pal-lateral);
    text-align: center;
    font-size: var(--font-label);
  }
}
</style>
