import { RPC, SCHEMA_EDIT }           from '../../shared/dataset/dictionary.js'
import { callDataset, renderSchema } from './_db_helpers.js'
import { createBus }                 from '../lib/bus.js'

const bus = createBus('db_schema_edit')

function summarize (op) {
  if (!op?.op) return ''
  switch (op.op) {
    case SCHEMA_EDIT.CREATE:           return `create (${ (op.props || []).length } field(s))`
    case SCHEMA_EDIT.RENAME_FIELD:     return `rename_field ${ op.key }→${ op.to }`
    case SCHEMA_EDIT.ADD_FIELD:        return `add_field ${ op.field?.key ?? '' }`
    case SCHEMA_EDIT.SET_DISPLAY_PROP: return `set_display_prop ${ op.value ?? '' }`.trim()
    default:                           return `${ op.op } ${ op.key ?? '' }`.trim()
  }
}

/** One DDL op against a collection's structure (table + metadata + field). Applied immediately. */
export async function handle ({ name, op } = {}) {
  const ev = bus.op(name || '(none)')
  const res = await callDataset(RPC.SCHEMA_EDIT, { name, op })
  ev.ok(summarize(op))
  return { text: renderSchema(res) }
}
