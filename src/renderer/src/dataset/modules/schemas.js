import { reactive } from 'vue'
import Sig          from 'a-signal'

import { net } from './net.js'
import { RPC, SCHEMA_EDIT } from '@shared/dictionary.js'
import { filters } from '@shared/filters.js'

/**
 * Reactive registry of collection schemas, fetched from the server.
 * Shape: { list: [{name, schema}], byName: { [name]: schema } }
 */
const state = reactive({
  list: [],
  byName: {},
  ready: false,
})

const when = {
  ready: new Sig({ late: true, memorable: true }),
}

async function loadAll () {
  const list = await net.wse.call(RPC.SCHEMA_LIST)
  state.list = list
  state.byName = Object.fromEntries(list.map(({ name, schema }) => [ name, schema ]))
  state.ready = true
  when.ready.emit(state.list)
}

function get (name) {
  return state.byName[name] || null
}

// ---- mutation helpers — RPC only, store updates come from broadcast ----
// All structure changes go through one DDL op (RPC.SCHEMA_EDIT). Each call
// carries ONE op and returns the full schema; a passed array is serialised into
// sequential single-op calls (no all-or-nothing across them).

async function edit (name, ops) {
  const list = Array.isArray(ops) ? ops : [ ops ]
  let res
  for (const op of list) res = await net.wse.call(RPC.SCHEMA_EDIT, { name, op })
  return res
}

async function create (name, { description = '', displayProp, prefix, props = [] } = {}) {
  const op = { op: SCHEMA_EDIT.CREATE, prefix, description, props }
  if (displayProp) op.displayProp = displayProp
  return edit(name, op)
}

async function setIdgen (name, prefix) {
  return edit(name, { op: SCHEMA_EDIT.SET_IDGEN, prefix })
}

async function remove (name) {
  // UI drops cascade: clear references to this collection in others.
  return edit(name, { op: SCHEMA_EDIT.DELETE, force: true })
}

export const schemas = {
  state,
  when,
  loadAll,
  get,
  create,
  setIdgen,
  remove,
  edit,
  displayPropKey: filters.displayPropKey,
  displayLabel: filters.displayLabel,
}
