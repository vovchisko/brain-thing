import { ref, reactive, computed, watch } from 'vue'

import { data }    from '@/dataset/modules/data.js'
import { schemas } from '@/dataset/modules/schemas.js'
import { filters } from '@shared/filters.js'

/**
 * Paginated, searchable, scroll-to-load-more state for a reference picker.
 *
 *   const picker = useRefPicker('categories', { pageSize: 50 })
 *   picker.open()           // fetch first page
 *   picker.search.value = 'foo'   // debounced refetch
 *   picker.loadMore()       // append next page (called on scroll bottom)
 *   picker.options          // computed list of fetched options for the dropdown
 *   picker.labelFor(id)     // resolve a label (uses global cache)
 *
 * The picker DOES NOT touch any Store. It fetches via `data.list` (which merges
 * `refs` into the global label cache as a side-effect — so labels for selected
 * ids stay visible even when those ids are not on the current page).
 */
export function useRefPicker (referenceTo, { pageSize = 50 } = {}) {
  const search = ref('')
  const isOpen = ref(false)
  const loading = ref(false)
  const hasMore = ref(false)
  const total = ref(0)
  const offset = ref(0)
  const items = reactive([])   // accumulated rows across pages
  let lastFetchToken = 0

  const targetSchema = computed(() => schemas.get(referenceTo))
  const displayKey = computed(() => filters.displayPropKey(targetSchema.value))

  const buildFilters = (q) => q ? [ { key: displayKey.value, op: 'contains', value: q } ] : []

  async function fetchPage ({ reset = false } = {}) {
    const token = ++lastFetchToken
    loading.value = true
    try {
      const startOffset = reset ? 0 : offset.value
      const res = await data.list(referenceTo, {
        offset: startOffset,
        limit: pageSize,
        filters: buildFilters(search.value),
      })
      // discard if a newer fetch has started (search changed mid-flight)
      if (token !== lastFetchToken) return
      if (reset) items.splice(0, items.length, ...res.data)
      else items.push(...res.data)
      offset.value = startOffset + res.data.length
      total.value = res.total
      hasMore.value = res.hasMore
    } finally {
      if (token === lastFetchToken) loading.value = false
    }
  }

  async function open () {
    if (isOpen.value) return
    isOpen.value = true
    if (items.length === 0) await fetchPage({ reset: true })
  }

  function close () {
    isOpen.value = false
  }

  async function loadMore () {
    if (loading.value || !hasMore.value) return
    await fetchPage({ reset: false })
  }

  // Debounced re-search on input.
  let searchTimer = null
  watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      if (isOpen.value) fetchPage({ reset: true })
    }, 200)
  })

  /** Resolved label from the global cache, or `null` on miss. */
  function labelFor (id) {
    if (id == null) return null
    return data.labelFor(referenceTo, id)
  }

  return {
    search, isOpen, loading, hasMore, total, offset,
    options: items,
    targetSchema, displayKey,
    open, close, loadMore, fetchPage,
    labelFor,
  }
}
