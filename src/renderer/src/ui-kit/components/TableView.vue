<template>
  <div
      :style="{
      '--row-height': `${ROW_HEIGHT}px`,
      '--table-row-width': `${tableWidth}px`,
      '--table-actions-width': `${ACTIONS_WIDTH}px`,
    }"
      class="table-view"
  >
    <div ref="containerRef" class="table-view_content" @scroll="onScroll">
      <div class="table-view_header">
        <div v-if="$slots.actions" class="table-view_header-cell _actions" />
        <div v-for="prop in columns" :key="prop.key"
             :style="{ width: `${colWidths[prop.key]}px` }"
             class="table-view_header-cell"
             :class="{ '_sortable': isSortable(prop), '_sorted': sort?.key === prop.key }"
             @click="onHeaderClick(prop)">
          <span class="table-view_header-label">{{ prop.key }}</span>
          <span v-if="sort?.key === prop.key" class="table-view_sort-indicator">
            {{ sort.dir === 'desc' ? '▼' : '▲' }}
          </span>
          <div class="table-view_resize-handle" @mousedown.stop="startResize($event, prop.key)" @click.stop />
        </div>
      </div>

      <div class="table-view_body" :style="{ height: `${totalHeight}px` }">
        <div
            v-for="row in visibleRows"
            :key="row.key"
            :style="{ transform: `translateY(${row.top}px)` }"
            class="table-view_row"
            :class="{ '_placeholder': !row.item }"
        >
          <div v-if="$slots.actions" class="table-view_cell _actions">
            <slot v-if="row.item" :item="row.item" name="actions" />
          </div>
          <div v-for="prop in columns" :key="prop.key"
               :style="{ width: `${colWidths[prop.key]}px` }"
               class="table-view_cell"
               :class="{ '_id': prop.key === 'id' }">
            <template v-if="row.item">
              <span v-if="prop.key === 'id'" class="table-view_id">{{ row.item.id }}</span>
              <PropView v-else :property-schema="prop" :value="row.item[prop.key]" />
            </template>
            <span v-else class="table-view_skeleton" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { tableSettings } from '@/dataset/modules/ui.js'
import PropView          from '../prop-view/PropView.vue'

const ROW_HEIGHT = 48
const BUFFER_SIZE = 10           // extra rows rendered above/below viewport
const DEFAULT_COL_WIDTH = 180
const ID_COL_WIDTH = 80
const ACTIONS_WIDTH = 48

const ID_COLUMN = Object.freeze({ key: 'id', label: 'ID', type: 'string', format: 'text', readOnly: true })

const props = defineProps({
  schema: { type: Object, required: true },
  store:  { type: Object, required: true },
  sort:   { type: Object, default: null },          // { key, dir } | null
})

const emit = defineEmits([ 'range-changed', 'sort-changed' ])

// Every field is sortable server-side: reference → target label, list → element
// count, scalars → natural order.
const isSortable = () => true

// Toggle: none → asc → desc → none.
function onHeaderClick (prop) {
  if (!isSortable(prop)) return
  const current = props.sort
  let next
  if (!current || current.key !== prop.key) next = { key: prop.key, dir: 'asc' }
  else if (current.dir === 'asc') next = { key: prop.key, dir: 'desc' }
  else next = null
  emit('sort-changed', next)
}

const containerRef = ref(null)
const viewportHeight = ref(0)
const scrollTop = ref(0)

const colWidths = reactive({})

const columns = computed(() => [ ID_COLUMN, ...props.schema.props ])

const storageKey = computed(() => `table-col-widths-${ props.schema.label || 'schema' }`)

const initColWidths = () => {
  const saved = tableSettings.get(storageKey.value)
  columns.value.forEach(prop => {
    const fallback = prop.key === 'id' ? ID_COL_WIDTH : DEFAULT_COL_WIDTH
    colWidths[prop.key] = saved?.[prop.key] || fallback
  })
}

const saveColWidths = () => {
  tableSettings.set(storageKey.value, { ...colWidths })
}

const tableWidth = computed(() => {
  let total = ACTIONS_WIDTH
  columns.value.forEach(prop => {
    total += colWidths[prop.key] || DEFAULT_COL_WIDTH
  })
  return total
})

const totalHeight = computed(() => props.store.total * ROW_HEIGHT)

const visibleRange = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER_SIZE)
  const count = Math.ceil(viewportHeight.value / ROW_HEIGHT) + BUFFER_SIZE * 2
  const end = Math.min(props.store.total, start + count)
  return { start, end }
})

const visibleRows = computed(() => {
  const out = []
  const { start, end } = visibleRange.value
  for (let i = start; i < end; i++) {
    out.push({
      key: i,
      top: i * ROW_HEIGHT,
      item: props.store.itemAt(i),
    })
  }
  return out
})

// Notify parent when visible range moves so it can refetch window if needed.
// Debounced — quick wheel/keyboard scrolls coalesce into a single emit after
// the user stops moving. fetchWindow on the parent side has token-based race
// protection (see data.js) so out-of-order responses are discarded anyway.
let rangeNotifyTimer = null
const RANGE_DEBOUNCE_MS = 80
watch(visibleRange, (range) => {
  if (rangeNotifyTimer) clearTimeout(rangeNotifyTimer)
  rangeNotifyTimer = setTimeout(() => emit('range-changed', range), RANGE_DEBOUNCE_MS)
}, { immediate: false })

const resize = reactive({ active: false, columnKey: null, startX: 0, startWidth: 0 })

let ticking = false

const startResize = (event, columnKey) => {
  event.preventDefault()
  resize.active = true
  resize.columnKey = columnKey
  resize.startX = event.clientX
  resize.startWidth = colWidths[columnKey]
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', endResize)
  document.body.style.cursor = 'col-resize'
}

const handleResize = event => {
  if (!resize.active) return
  if (!ticking) {
    requestAnimationFrame(() => {
      colWidths[resize.columnKey] = Math.max(50, resize.startWidth + (event.clientX - resize.startX))
      ticking = false
    })
    ticking = true
  }
}

const endResize = () => {
  resize.active = false
  resize.columnKey = null
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', endResize)
  document.body.style.cursor = ''
  saveColWidths()
}

const onScroll = event => {
  scrollTop.value = event.target.scrollTop
}

const updateViewportHeight = () => {
  if (containerRef.value) viewportHeight.value = containerRef.value.clientHeight
}

watch(() => props.schema, () => initColWidths(), { immediate: true })

// Reset scroll position when switching collections or when filters change
// (otherwise scroll persists and the user sees placeholders for rows past
// the new filtered total).
watch(() => props.store, () => {
  scrollTop.value = 0
  if (containerRef.value) containerRef.value.scrollTop = 0
})
watch(() => props.store.filters, () => {
  scrollTop.value = 0
  if (containerRef.value) containerRef.value.scrollTop = 0
}, { deep: true })

onMounted(() => {
  initColWidths()
  updateViewportHeight()
  window.addEventListener('resize', updateViewportHeight)
  // Fire an initial range so the parent can ensure a window is loaded.
  emit('range-changed', visibleRange.value)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportHeight)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', endResize)
  if (rangeNotifyTimer) clearTimeout(rangeNotifyTimer)
})
</script>

<style lang="scss" scoped>
.table-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background-color: var(--bg);

  &_content {
    flex: 1;
    overflow: auto;
    position: relative;
    @include scroll-styled();
  }

  &_header {
    display: flex;
    min-height: var(--row-height);
    position: sticky;
    top: 0;
    z-index: 3;
    background-color: var(--bg);
    border-bottom: 1px solid var(--border);
    width: var(--table-row-width);
  }

  &_header-cell {
    padding: spacing(100, 200);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    flex-grow: 0;
    background-color: var(--bg);
    border-right: 1px solid var(--border);
    font-weight: bold;
    position: relative;
    user-select: none;

    &:last-of-type {
      border-right: none;
    }

    &._actions {
      width: var(--table-actions-width);
      min-width: var(--table-actions-width);
      max-width: var(--table-actions-width);
      position: sticky;
      left: 0;
      z-index: 1;
      padding: 0;
      justify-content: center;
    }

    &._sortable {
      cursor: pointer;

      &:hover {
        background-color: var(--bg-raised);
      }
    }

    &._sorted {
      color: var(--accent-hover);
    }
  }

  &_header-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &_sort-indicator {
    margin-left: spacing(100);
    font-size: var(--font-label);
  }

  &_resize-handle {
    position: absolute;
    width: 8px;
    right: 0;
    top: 0;
    bottom: 0;
    cursor: col-resize;
    background-color: transparent;

    &:hover {
      background-color: rgba(var(--rgb-accent), 0.1);
    }
  }

  &_body {
    position: relative;
    width: var(--table-row-width);
  }

  &_row {
    display: flex;
    min-height: var(--row-height);
    height: var(--row-height);
    position: absolute;
    left: 0;
    top: 0;
    border-bottom: 1px solid var(--border);
    width: var(--table-row-width);

    &:hover {
      background-color: var(--bg-raised);
    }

    &:hover .table-view_cell {
      background-color: var(--bg-raised);
    }

    &._placeholder {
      opacity: 0.4;
    }
  }

  &_cell {
    padding: spacing(100, 200);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    flex-grow: 0;
    background-color: var(--bg);
    border-right: 1px solid var(--border);
    user-select: text;

    &:last-of-type {
      border-right: none;
    }

    &._actions {
      width: var(--table-actions-width);
      min-width: var(--table-actions-width);
      max-width: var(--table-actions-width);
      padding: 0;
      justify-content: center;
      position: sticky;
      left: 0;
      z-index: 1;

      :deep(button) {
        color: var(--text-soft);
      }
    }

    .table-view_row:hover &._actions :deep(button) {
      color: var(--text);
    }
  }

  &_skeleton {
    display: inline-block;
    width: 60%;
    height: 12px;
    border-radius: 4px;
    background: var(--bg-btn);
  }

  &_id {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-label);
    color: var(--text-soft);
  }
}
</style>
