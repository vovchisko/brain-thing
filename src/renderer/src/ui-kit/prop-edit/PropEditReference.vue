<template>
  <ui-dropdown :auto-scroll="false" class="prop-edit-reference" @open="picker.open" @close="picker.close">
    <template #default="{ isOpen }">
      <ui-button class="prop-edit-reference_trigger" hollow>
        <span class="prop-edit-reference_trigger-text">{{ displayValue }}</span>
        <ui-icon :name="isOpen ? ICON.CHEVRON_UP : ICON.CHEVRON_DOWN" />
      </ui-button>
    </template>

    <template #content="{ dropdownClose }">
      <div class="prop-edit-reference_content">
        <div class="prop-edit-reference_search">
          <ui-input v-model="picker.search.value" auto-focus placeholder="Search...">
            <template #right>
              <ui-icon
                  v-if="picker.search.value"
                  :name="ICON.CROSS"
                  class="prop-edit-reference_search-clear"
                  @click="picker.search.value = ''"
              />
            </template>
          </ui-input>
        </div>

        <div ref="listRef" class="prop-edit-reference_list" @scroll="onScroll">
          <ui-button
              v-if="nullable && modelValue"
              class="prop-edit-reference_clear"
              naked small
              @click="select(null, dropdownClose)"
          >
            Clear
            <ui-icon :name="ICON.TRASH" />
          </ui-button>

          <ui-dropdown-item
              v-for="item in options"
              :key="item.id"
              :active="item.id === modelValue"
              auto-close
              interactive
              @click="select(item.id, dropdownClose)"
          >
            {{ schemas.displayLabel(item, picker.targetSchema.value) }}
          </ui-dropdown-item>

          <div v-if="picker.loading.value" class="prop-edit-reference_status">Loading…</div>
          <div v-else-if="!options.length" class="prop-edit-reference_status">No items.</div>
          <div v-else-if="!picker.hasMore.value" class="prop-edit-reference_status">— end —</div>
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
import UiDropdownItem    from '@/ui-kit/atmos/UiDropdownItem.vue'
import UiButton          from '@/ui-kit/atmos/UiButton.vue'
import UiInput           from '@/ui-kit/atmos/UiInput.vue'
import UiIcon            from '@/ui-kit/atmos/UiIcon.vue'
import { ICON }          from '@/ui-kit/atmos/UiIconParts/icon-names.js'

const props = defineProps({
  modelValue: { type: String, default: null },
  referenceTo: { type: String, required: true },
  nullable: { type: Boolean, default: false },
  excludeId: { type: String, default: null },   // the editing row's own id — never offer it (no self-loop)
})

const emit = defineEmits([ 'update:modelValue' ])

const picker = useRefPicker(props.referenceTo)
const listRef = ref(null)

const options = computed(() => props.excludeId ? picker.options.filter(o => o.id !== props.excludeId) : picker.options)

const displayValue = computed(() => {
  if (!props.modelValue) return '— None —'
  return picker.labelFor(props.modelValue) || `? ${ props.modelValue }`
})

function select (id, dropdownClose) {
  emit('update:modelValue', id)
  dropdownClose?.()
}

function onScroll (e) {
  const el = e.target
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) picker.loadMore()
}
</script>

<style lang="scss" scoped>
.prop-edit-reference {
  display: flex;
  flex: 1;

  &_trigger {
    flex: 1;
    min-width: 0;
    max-width: 100%;
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
    @include scroll-styled();
  }

  &_clear {
    width: 100%;
    justify-content: space-between;
    margin-bottom: spacing(100);
    color: var(--ui-pal-lateral);

    &:hover { color: var(--ui-pal-negative); }
  }

  &_status {
    padding: spacing(200, 400);
    color: var(--ui-pal-lateral);
    text-align: center;
    font-size: var(--font-label);
  }
}
</style>
