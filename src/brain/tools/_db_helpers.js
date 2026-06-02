import { dataset }         from '../dataset/index.js'
import { ApiError }        from '../lib/api.js'
import { ERR_HTTP, TYPES }  from '../../shared/dataset/dictionary.js'
import { dates }            from '../../shared/dataset/dates.js'

/** Run a dataset RPC, translating its string-coded errors into ApiError so wrap() renders clean text. */
export async function callDataset (rpc, input) {
  try {
    return await dataset.call(rpc, input)
  } catch (err) {
    const status = ERR_HTTP[err.code] || 500
    throw new ApiError(status, err.text || err.message || 'Dataset error.')
  }
}

/**
 * Field-type signature, shared by the row header and the schema listing —
 * `reference(people)`, `subset(people[])`, `enum(todo, doing, done)`, bare
 * `string`/`number`/`boolean`/`date`/`array`. The row header passes
 * `enumValues:false` (just `enum`) to stay terse; db_schema keeps the options.
 * Decorative `format` never appears on the MCP surface (referential integrity
 * keys off `type`, not `format`).
 */
function fieldSig (prop, { enumValues = true } = {}) {
  const ref = prop.rules?.referenceTo
  if (prop.type === TYPES.REFERENCE) return `reference(${ ref })`
  if (prop.type === TYPES.SUBSET)    return `subset(${ ref }[])`
  if (prop.type === TYPES.ENUM) {
    const opts = prop.rules?.options || []
    return enumValues && opts.length ? `enum(${ opts.join(', ') })` : 'enum'
  }
  return prop.type
}

/**
 * Render one row cell as a JSON-native typed value the model can copy straight
 * back into a write — faithful to the STORED type: strings quoted, numbers and
 * booleans bare, an enum follows whatever it stored (string `"3"` vs number `3`),
 * array items keep their own types, dates and ids bare, `null` for absent, `[]`
 * for an empty list. No `—` glyph (the model would copy it); the `—` stays in the
 * UI's PropView. Ids stay bare — labels are kept off the MCP surface.
 */
function renderValue (value, prop) {
  if (value === null || value === undefined) return 'null'
  switch (prop?.type) {
    case TYPES.DATE:      return dates.format(value, prop.rules?.precision)
    case TYPES.REFERENCE: return String(value)                                   // bare id
    case TYPES.SUBSET:    return `[${ (value || []).join(', ') }]`                // bare ids
    case TYPES.ARRAY:     return `[${ (value || []).map(v => JSON.stringify(v)).join(', ') }]`
    default:              return JSON.stringify(value)   // string/enum/number/boolean — type-faithful
  }
}

/** One-line field signature for the row reply, so the model reads bare-id rows knowing the field→collection map. */
function renderSig (props) {
  return props.map(p => `${ p.key }:${ fieldSig(p, { enumValues: false }) }`).join(', ')
}

/** Compact text for db_query / db_get. `res` is the COLLECTION_LIST/GET response. */
export function renderRows (res, collection, schema) {
  // db_get returns { item }; db_query returns { data, total, ... }
  const rows = res.data ? res.data : (res.item ? [ res.item ] : [])
  const props = schema?.props || []
  const head = `=== ${ collection } ===`
  const sig = props.length ? `\n${ renderSig(props) }` : ''

  if (rows.length === 0) return `${ head }${ sig }\n\nNo rows.`

  const cols = props.length ? props.map(p => p.key) : Object.keys(rows[0]).filter(k => k !== 'id')
  const lines = rows.map(row => {
    const cells = cols.map(key => {
      const prop = props.find(p => p.key === key)
      return `${ key }=${ renderValue(row[key], prop) }`
    })
    return `${ row.id }  ${ cells.join('  ') }`
  })

  let out = `${ head }${ sig }\n\n${ lines.join('\n') }`

  // Stats line only for db_query (has a total). db_get is a single row, no stats.
  if (res.total != null) {
    const shown = (res.offset || 0) + rows.length
    let stats = `${ res.total } row${ res.total === 1 ? '' : 's' }`
    if (rows.length !== res.total) stats += ` · showing ${ rows.length }`
    if (res.total > shown) stats += ` · ${ res.total - shown } more (use offset/limit to page)`
    out += `\n\n${ stats }`
  }
  return out
}

/** Render one collection: `=== name — desc ===` + ids/display + `- key: fieldSig` lines. */
function renderOne ({ name, schema }) {
  const desc = schema.description ? ` — ${ schema.description }` : ''
  const meta = []
  if (schema.idgen?.prefix) meta.push(`ids: ${ schema.idgen.prefix }-<n>`)
  if (schema.displayProp)   meta.push(`display: ${ schema.displayProp }`)
  const fields = (schema.props || []).map(p => `- ${ p.key }: ${ fieldSig(p) }`).join('\n')
    || '- (no fields yet — add with db_schema_edit add_field)'
  return [ `=== ${ name }${ desc } ===`, ...meta, fields ].join('\n')
}

/** Summary for db_schema (no name). `list` is the SCHEMA_LIST response. */
export function renderSchemas (list) {
  if (!list.length) return 'No collections yet. Use db_schema_edit with a "create" op to define one.'
  return list.map(renderOne).join('\n\n')
}

/** Render a single collection's full schema (db_schema / db_schema_edit replies). */
export function renderSchema (res) {
  if (res?.deleted) return `Deleted collection "${ res.name }".` + (res.cleared?.length ? ` Cleared ${ res.cleared.length } reference(s) in other collections.` : '')
  let out = renderOne(res)
  if (res?.notes?.length) out += '\n' + res.notes.map(n => `Note: ${ n }`).join('\n')
  return out
}
