<template>
  <div v-if="!schema" class="collection-screen _missing">
    <h1>Unknown collection: {{ collection }}</h1>
  </div>

  <div v-else class="collection-screen">
    <div class="lt-screen_header">
      <div class="lt-titles">
        <div class="lt-titles_name">{{ collection }}</div>
        <div v-if="schema.description" class="lt-titles_desc">{{ schema.description }}</div>
        <div class="lt-titles_meta">
          {{ visibleCount }}<span v-if="store.total !== visibleCount"> / {{ store.total }}</span> records
        </div>
      </div>
    </div>

    <div class="lt-toolbar">
      <ui-button @click="openCreate">Create</ui-button>
      <filter-sidebar
          :key="collection"
          v-model="activeFilters"
          :filterable-fields="filterableFields"
          :schema="schema"
          :store="store"
      />
    </div>

    <div class="lt-screen_content">
      <table-view
          v-if="store.total > 0"
          :schema="schema"
          :store="store"
          :sort="activeSort"
          @range-changed="onRangeChanged"
          @sort-changed="onSortChanged"
      >
        <template #actions="{ item }">
          <ui-button class="ui-secondary" naked @click="openEdit(item)">
            <ui-icon :name="ICON.PEN_FRAME" />
          </ui-button>
        </template>
      </table-view>

      <p v-else class="collection-screen_empty">No data.</p>
    </div>

    <ui-modal :is-open="!!state.editing" @close="closeEdit">
      <template #header>{{ state.isNew ? 'Create' : 'Edit' }} — {{ collection }}</template>

      <div class="lt-form">
        <div class="lt-form_fields">
          <div v-for="prop in schema.props" :key="prop.key" class="lt-form_fields-item">
            <label>{{ prop.key }}</label>
            <PropView v-if="prop.readOnly" :property-schema="prop" :value="state.editing[prop.key]"
                      class="lt-form_fields-item_readonly" />
            <PropEdit v-else v-model="state.editing[prop.key]" :property-schema="prop"
                      :exclude-id="prop.rules?.referenceTo === collection ? state.editing.id : null" />
          </div>
        </div>

        <div class="lt-form_actions-buttons">
          <ui-button class="ui-secondary" @click="closeEdit">Cancel</ui-button>
          <ui-button v-if="!state.isNew" hollow class="ui-negative" @click="onDelete">
            <ui-icon :name="ICON.TRASH" />
          </ui-button>
          <hr />
          <ui-button @click="onSave">Save</ui-button>
        </div>
      </div>
    </ui-modal>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

import { data }       from '@/dataset/modules/data.js'
import { schemas }    from '@/dataset/modules/schemas.js'
import { alerts }     from '@/dataset/modules/alert.js'
import { ICON }       from '@/ui-kit/atmos/UiIconParts/icon-names.js'
import TableView      from '@/ui-kit/components/TableView.vue'
import FilterSidebar  from '@/ui-kit/components/FilterSidebar.vue'
import PropView       from '@/ui-kit/prop-view/PropView.vue'
import PropEdit       from '@/ui-kit/prop-edit/PropEdit.vue'

const WINDOW_SIZE = 200          // rows kept around the viewport
const REFETCH_MARGIN = 50        // refetch when viewport gets within this many rows of window edge

const props = defineProps({
  collection: { type: String, required: true },
})

const schema = computed(() => schemas.get(props.collection))
const store = computed(() => data.ensure(props.collection))

const filterableFields = computed(() => (schema.value?.props || []).map(p => ({ key: p.key, label: p.key })))
const activeFilters = ref([])
const activeSort = ref(null)                     // { key, dir } | null

const visibleCount = computed(() => store.value.items.length)

const state = reactive({
  editing: null,
  isNew: false,
})

function emptyEntity () {
  const out = {}
  for (const p of schema.value.props) {
    // JSON round-trip drops Vue reactive proxies that structuredClone can't handle.
    out[p.key] = p.def !== undefined ? JSON.parse(JSON.stringify(p.def)) : (p.type === 'array' ? [] : null)
  }
  return out
}

function openCreate () {
  state.editing = emptyEntity()
  state.isNew = true
}

function openEdit (item) {
  state.editing = JSON.parse(JSON.stringify(item))
  state.isNew = false
}

function closeEdit () {
  state.editing = null
  state.isNew = false
}

async function onSave () {
  try {
    if (state.isNew) {
      await data.create(props.collection, state.editing)
    } else {
      const { id, ...patch } = state.editing
      await data.update(props.collection, id, patch)
    }
    closeEdit()
  } catch (err) {
    alerts.alert(err)
  }
}

async function onDelete () {
  const confirmed = await alerts.confirm(`Delete this ${ props.collection } record?`, 'Delete')
  if (!confirmed) return
  try {
    await data.remove(props.collection, state.editing.id)
    closeEdit()
  } catch (err) {
    alerts.alert(err)
  }
}

function onSortChanged (next) {
  activeSort.value = next
}

// Refetch window when viewport approaches its edge.
let pendingFetch = null
async function onRangeChanged ({ start, end }) {
  const winStart = store.value.offset
  const winEnd = winStart + store.value.items.length

  // Inside window with comfortable margin — nothing to do.
  if (start >= winStart + REFETCH_MARGIN && end <= winEnd - REFETCH_MARGIN) return
  // Viewport drifted outside / near edge — refetch centered around viewport.
  const desiredOffset = Math.max(0, Math.floor((start + end) / 2) - Math.floor(WINDOW_SIZE / 2))
  if (pendingFetch === desiredOffset) return
  pendingFetch = desiredOffset
  try {
    await data.fetchWindow(props.collection, {
      offset: desiredOffset,
      limit: WINDOW_SIZE,
      filters: activeFilters.value,
      sort: activeSort.value,
    })
  } catch (err) {
    alerts.alert(err)
  } finally {
    pendingFetch = null
  }
}

// Filter or sort change → reset to top of result set.
watch([ activeFilters, activeSort ], async ([ filters, sort ]) => {
  try {
    await data.fetchWindow(props.collection, { offset: 0, limit: WINDOW_SIZE, filters, sort })
  } catch (err) {
    alerts.alert(err)
  }
}, { deep: true })

// Collection switch — clear filters + sort, load initial window.
watch(() => props.collection, async (name) => {
  activeFilters.value = []
  activeSort.value = null
  if (!name || !schema.value) return
  await data.fetchWindow(name, { offset: 0, limit: WINDOW_SIZE, filters: [], sort: null })
}, { immediate: true })

// React to broadcast invalidation — sync sets store.stale, we refetch the current window.
watch(() => store.value.stale, async (isStale) => {
  if (!isStale) return
  await data.fetchWindow(props.collection, {
    offset: store.value.offset,
    limit: Math.max(WINDOW_SIZE, store.value.items.length),
    filters: activeFilters.value,
    sort: activeSort.value,
  })
})
</script>

<style lang="scss" scoped>
.collection-screen {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;

  &._missing {
    align-items: center;
    justify-content: center;
    color: var(--text-soft);
  }

  &_empty {
    padding: spacing(400);
    color: var(--text-soft);
    text-align: center;
  }
}
</style>
