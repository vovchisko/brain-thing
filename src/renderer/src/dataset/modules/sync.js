import { data, refs }     from './data.js'
import { schemas }        from './schemas.js'
import { filters }        from '@shared/filters.js'

/**
 * Six focused handlers — one per broadcast kind. Wired in `net.js` via
 * `transport.onItemCreated(sync.itemCreated)` etc. No `kind` checks: each
 * function knows exactly what it gets.
 *
 * All collection stores are windowed mirrors; we don't mutate `items` here.
 * If a broadcast might affect the current view, we set `store.stale = true`
 * and `CollectionScreen` refetches.
 */

function itemCreated ({ collection, item }) {
  const store = data.get(collection)
  if (store && filters.matchesFilters(item, store.filters)) store.stale = true
}

function itemUpdated ({ collection, item }) {
  // Ref cache: refresh the label for any id we've cached.
  const bucket = refs.get(collection)
  if (bucket?.has(item.id)) {
    const targetSchema = schemas.get(collection)
    bucket.set(item.id, { id: item.id, label: filters.displayLabel(item, targetSchema) })
  }
  const store = data.get(collection)
  if (store && filters.matchesFilters(item, store.filters)) store.stale = true
}

function itemDeleted ({ collection, id }) {
  const bucket = refs.get(collection)
  if (bucket?.has(id)) bucket.delete(id)
  const store = data.get(collection)
  if (store && store.items.some(i => i.id === id)) store.stale = true
}

function schemaCreated ({ name, schema }) {
  if (!schemas.state.list.some(s => s.name === name)) {
    schemas.state.list.push({ name, schema })
  }
  schemas.state.byName[name] = schema
}

function schemaUpdated ({ name, schema }) {
  const idx = schemas.state.list.findIndex(s => s.name === name)
  if (idx !== -1) schemas.state.list[idx] = { name, schema }
  else schemas.state.list.push({ name, schema })
  schemas.state.byName[name] = schema
  // Server-side migration touched every item — invalidate window and refs.
  const store = data.get(name)
  if (store) store.stale = true
  refs.delete(name)
}

function schemaDeleted ({ name }) {
  const idx = schemas.state.list.findIndex(s => s.name === name)
  if (idx !== -1) schemas.state.list.splice(idx, 1)
  delete schemas.state.byName[name]
  data.drop(name)
  refs.delete(name)
}

export const sync = {
  itemCreated, itemUpdated, itemDeleted,
  schemaCreated, schemaUpdated, schemaDeleted,
}
