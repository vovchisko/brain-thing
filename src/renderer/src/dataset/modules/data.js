import { reactive } from 'vue'

import { net } from './net.js'
import { RPC } from '@shared/dictionary.js'

/**
 * Windowed-only store. `total` is the server-side filtered count; `offset` and
 * `items` describe the slice currently in memory. `itemAt(globalIdx)` returns
 * either the row or `null` (means "outside loaded window, render placeholder").
 *
 * Each instance is wrapped in `reactive()` at construction so every property
 * — including primitives like `total`/`offset` — is tracked by Vue.
 *
 * Mutations from the network arrive via broadcasts (see modules/sync.js); the
 * RPC helpers below DO NOT touch the store — the broadcast handler is the
 * single source of update.
 */
export class Store {
  constructor () {
    this.total = 0
    this.offset = 0
    this.items = []
    this.filters = []
    this.sort = null
    /** Set by sync when a broadcast invalidates the current window. */
    this.stale = false
  }

  itemAt (globalIdx) {
    if (globalIdx < this.offset || globalIdx >= this.offset + this.items.length) return null
    return this.items[globalIdx - this.offset] || null
  }

  clear () {
    this.items.length = 0
    this.total = 0
    this.offset = 0
    this.filters = []
    this.sort = null
    this.stale = false
  }
}

/** Map<collectionName, Store>. */
const stores = new Map()

/**
 * Cache of resolved reference entries, populated by every `collection.list`
 * response that carries `refs`. Structure:
 *
 *   refs:        Map<collectionName, Map<id, { id, label, ... }>>
 *
 * Wire shape is per-collection arrays of `{id, label}` — see Dataset
 * `buildRefs`. `mergeRefs()` indexes them into nested Maps. Both layers are
 * reactive (Vue 3 reactive Map), so PropViewReference / PropViewSubset re-
 * render automatically whenever a label is added or replaced.
 */
export const refs = reactive(new Map())

function bucketFor (collection) {
  let bucket = refs.get(collection)
  if (!bucket) {
    bucket = reactive(new Map())
    refs.set(collection, bucket)
  }
  return bucket
}

function mergeRefs (incoming) {
  if (!incoming) return
  for (const [ collection, list ] of Object.entries(incoming)) {
    if (!Array.isArray(list)) continue
    const bucket = bucketFor(collection)
    for (const entry of list) {
      if (entry?.id != null) bucket.set(entry.id, entry)
    }
  }
}

function ensure (name) {
  let s = stores.get(name)
  if (!s) {
    s = reactive(new Store())
    stores.set(name, s)
  }
  return s
}

function get (name) {
  return stores.get(name) || null
}

function drop (name) {
  stores.delete(name)
}

function refFor (collection, id) {
  if (id == null) return null
  return refs.get(collection)?.get(id) ?? null
}

function labelFor (collection, id) {
  return refFor(collection, id)?.label ?? null
}

/**
 * Per-collection token used to discard stale window fetches. When the user
 * scrolls quickly we may have several `fetchWindow` calls in flight; only the
 * latest one is allowed to mutate the store.
 */
const fetchTokens = new Map()

/** Replace a windowed store's slice with [offset, offset+limit) for the given filters + sort. */
async function fetchWindow (name, { offset = 0, limit = 200, filters = [], sort = null } = {}) {
  const store = ensure(name)
  store.filters = filters
  store.sort = sort
  const myToken = (fetchTokens.get(name) || 0) + 1
  fetchTokens.set(name, myToken)

  const res = await net.wse.call(RPC.COLLECTION_LIST, { collection: name, offset, limit, filters, sort })

  // A newer fetch started while we were awaiting — drop this result on the floor.
  if (fetchTokens.get(name) !== myToken) return store

  store.offset = res.offset
  store.total = res.total
  store.items.splice(0, store.items.length, ...res.data)
  store.stale = false
  mergeRefs(res.refs)
  return store
}

/**
 * Generic paginated list — used by ref pickers (PropEditReference / Subset /
 * Filter) for their own dropdowns. Does NOT touch any Store; just returns the
 * raw response and merges refs into the global cache.
 */
async function list (name, { offset = 0, limit = 50, filters = [] } = {}) {
  const res = await net.wse.call(RPC.COLLECTION_LIST, { collection: name, offset, limit, filters })
  mergeRefs(res.refs)
  return res
}

// ---- mutation helpers — RPC only, store updates come from broadcast ----

async function create (name, payload) {
  const res = await net.wse.call(RPC.COLLECTION_CREATE, { collection: name, data: payload })
  return res.item
}

async function update (name, id, payload) {
  const res = await net.wse.call(RPC.COLLECTION_UPDATE, { collection: name, id, data: payload })
  return res.item
}

async function remove (name, id) {
  // UI deletes cascade: clear references to this row in other collections.
  await net.wse.call(RPC.COLLECTION_DELETE, { collection: name, id, force: true })
}

export const data = {
  stores,
  refs,
  ensure,
  get,
  drop,
  refFor,
  labelFor,
  fetchWindow,
  list,
  create,
  update,
  remove,
}
