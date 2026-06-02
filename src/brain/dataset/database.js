/**
 * Dataset — file-backed, schema-driven, dynamic-collection store.
 *
 *   import { Dataset } from './database.js'
 *   const db = new Dataset('/path/to/data')
 *   await db.open()
 *
 *   // schemas — atomic, single-purpose ops (no full-schema replace on the surface)
 *   db.schemas.list() / .get(name) / .create(name, schema) / .delete(name, { force })
 *   db.schemas.setDescription / .setDisplayProp / .addField / .removeField / .updateField / .renameField
 *   // (db.schemas.update(name, schema, renames) stays internal — bulk migration / tests)
 *
 *   const items = db.collection('items')
 *   items.list({ offset, limit, filters })   //  { data, total, refs, ... }
 *   items.get(id)                              //  { item, refs }
 *   items.create(data) / .createMany(rows) / .update(id, patch) / .delete(id, { force }) / .deleteMany(ids, { force })
 *
 *   // dataset-level signals (carry collection name; cover schemas too)
 *   db.when.itemCreated({ collection, item }  => ...)
 *   db.when.itemUpdated({ collection, item }  => ...)
 *   db.when.itemDeleted({ collection, id }    => ...)
 *   db.when.schemaCreated({ name, schema }    => ...)
 *   db.when.schemaUpdated({ name, schema }    => ...)
 *   db.when.schemaDeleted({ name }            => ...)
 *
 *   await db.close()
 */

import fs                                    from 'node:fs/promises'
import path                                  from 'node:path'
import Sig                                   from 'a-signal'
import { ERR, ErrorGeneric, FORMATS, FORMATS_BY_TYPE, TYPES } from '../../shared/dataset/dictionary.js'
import { filters }                           from '../../shared/dataset/filters.js'
import { dates }                             from '../../shared/dataset/dates.js'
import { ids }                               from '../../shared/dataset/ids.js'

const SCHEMA_SUFFIX = '.schema.json'
const STATS_SUFFIX = '.stats.json'
const NAME_RE = /^[a-z][a-z0-9_-]{0,63}$/i
const DEFAULT_LIMIT = 50

const log = (...a) => console.log('[dataset]', ...a)
const warn = (...a) => console.warn('[dataset]', ...a)
const error = (...a) => console.error('[dataset]', ...a)

function assertValidName (name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    throw new ErrorGeneric(ERR.BAD_REQUEST,
        `Invalid collection name "${ name }". Use only letters, digits, "_" and "-", starting with a letter (max 64 chars).`)
  }
}

function assertValidSchema (schema) {
  if (!schema || typeof schema !== 'object') {
    throw new ErrorGeneric(ERR.BAD_REQUEST, 'Schema must be an object.')
  }
  if (!Array.isArray(schema.props)) {
    throw new ErrorGeneric(ERR.BAD_REQUEST, 'Schema must have a "props" array.')
  }
  const seen = new Set()
  for (const p of schema.props) {
    if (!p || typeof p.key !== 'string') {
      throw new ErrorGeneric(ERR.BAD_REQUEST, 'Every schema prop must have a string "key".')
    }
    if (seen.has(p.key)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST, `Duplicate prop key "${ p.key }" — each prop key must be unique within a schema.`)
    }
    seen.add(p.key)
    if (!Object.values(TYPES).includes(p.type)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Prop "${ p.key }" has invalid type "${ p.type }". Allowed: ${ Object.values(TYPES).join(', ') }.`)
    }
    if (p.format && !Object.values(FORMATS).includes(p.format)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Prop "${ p.key }" has invalid format "${ p.format }". Allowed: ${ Object.values(FORMATS).join(', ') }.`)
    }
    if (p.type === TYPES.ENUM && !Array.isArray(p.rules?.options)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Enum prop "${ p.key }" must define "rules.options" as an array of allowed values.`)
    }
    if ((p.type === TYPES.REFERENCE || p.type === TYPES.SUBSET) && typeof p.rules?.referenceTo !== 'string') {
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `${ p.type === TYPES.SUBSET ? 'Subset' : 'Reference' } prop "${ p.key }" must define "rules.referenceTo" (the target collection).`)
    }
    if (p.type === TYPES.DATE && p.rules?.precision !== undefined && !dates.PRECISIONS.includes(p.rules.precision)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Date prop "${ p.key }" has invalid precision "${ p.rules.precision }". Allowed: ${ dates.PRECISIONS.join(', ') }.`)
    }

    if (p.def !== undefined && p.def !== null) {
      try {
        coerce(p, p.def)
      } catch (err) {
        throw new ErrorGeneric(ERR.BAD_REQUEST,
            `Default value for prop "${ p.key }" is invalid: ${ err.text || err.message }`)
      }
    }
  }

  if (schema.displayProp && !seen.has(schema.displayProp)) {
    throw new ErrorGeneric(ERR.BAD_REQUEST,
        `displayProp "${ schema.displayProp }" is not one of this schema's fields: ${ [ ...seen ].join(', ') || '(none)' }.`)
  }

  // Checked last: every collection has a mandatory, explicit id prefix (Storage B,
  // no default) — but a malformed prop should still report its own error first.
  if (!ids.isValidPrefix(schema.idgen?.prefix)) {
    throw new ErrorGeneric(ERR.BAD_REQUEST,
        `Schema must define idgen.prefix — an id prefix with no spaces and no leading digit (e.g. "TASK"). Got ${ describe(schema.idgen?.prefix) }.`)
  }
}

/**
 * A required reference/subset onto the collection's OWN rows is unsatisfiable:
 * the first row would have nothing to point at (and may not point at itself).
 * Same-collection refs are fine — they just can't be required. Needs the name,
 * so it lives outside assertValidSchema (which validates a schema in isolation)
 * and runs only where a new/changed schema is committed — never on load, so
 * existing data is never locked out over this rule.
 */
function assertNoRequiredSelfRef (name, schema) {
  for (const p of schema.props) {
    if (p.type !== TYPES.REFERENCE && p.type !== TYPES.SUBSET) continue
    if (p.rules?.referenceTo !== name) continue
    const required = p.rules?.required === true ||
        (schema.displayProp === p.key && p.rules?.required !== false)
    if (required) {
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Field "${ p.key }" references its own collection "${ name }" and cannot be required — ` +
          `the first row would have nothing to reference.`)
    }
  }
}

/**
 * Keep a field's format compatible with its type. Format-bearing types
 * (string/number/boolean/date/enum) must always carry a valid format — the UI
 * editors dispatch on it; format is omittable on the API but never stored empty.
 * An absent format defaults silently; an explicitly-wrong one is reset with a
 * note (surfaced to the caller). Format-free types (array/reference/subset) keep
 * none. Returns { field, note }.
 */
function normalizeFieldFormat (field) {
  const allowed = FORMATS_BY_TYPE[field.type]
  if (!allowed || (field.format && allowed.includes(field.format))) return { field, note: null }
  const def = allowed[0]
  const note = field.format
    ? `Field "${ field.key }": format "${ field.format }" is not valid for type "${ field.type }" — set to "${ def }".`
    : null
  return { field: { ...field, format: def }, note }
}

/**
 * Default every prop's format so a schema never carries an empty/invalid format
 * for a format-bearing type. Returns { schema, changed } — a new schema object
 * only when something was normalised, so callers can skip a no-op persist.
 */
function normalizeSchemaFormats (schema) {
  if (!Array.isArray(schema.props)) return { schema, changed: false }
  let changed = false
  const props = schema.props.map(p => {
    const { field } = normalizeFieldFormat(p)
    if (field !== p) changed = true
    return field
  })
  return changed ? { schema: { ...schema, props }, changed: true } : { schema, changed: false }
}

/**
 * THE single gate for any schema entering the engine — schema validation and
 * format fallback live here and nowhere else; every commit and load path runs
 * exactly this. Returns the schema with every prop's format defaulted to a valid
 * one for its type. `onLoad` skips the commit-only no-required-self-ref rule so
 * existing on-disk data is never locked out at open() (see assertNoRequiredSelfRef).
 */
function sanitizeSchema (name, schema, { onLoad = false } = {}) {
  assertValidSchema(schema)
  if (!onLoad) assertNoRequiredSelfRef(name, schema)
  return normalizeSchemaFormats(schema).schema
}

function defaultFor (prop) {
  if (typeof prop.def === 'function') return prop.def()
  if (prop.type === TYPES.ARRAY || prop.type === TYPES.SUBSET) return Array.isArray(prop.def) ? [ ...prop.def ] : []  // list types are always an array
  if (prop.def !== undefined) {
    if (prop.type === TYPES.DATE && prop.def !== null) return dates.parse(prop.def)
    return cloneDef(prop.def)
  }
  return null
}

function cloneDef (value) {
  if (Array.isArray(value)) return [ ...value ]
  if (value !== null && typeof value === 'object') return JSON.parse(JSON.stringify(value))
  return value
}

function coerce (prop, value) {
  if (value === null || value === undefined) return prop.type === TYPES.ARRAY || prop.type === TYPES.SUBSET ? [] : null

  switch (prop.type) {
    case TYPES.STRING: {
      if (typeof value === 'string') return value
      if (typeof value === 'number' && Number.isFinite(value)) return String(value)
      if (typeof value === 'boolean') return String(value)
      if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Field "${ prop.key }" expects text, but got ${ describe(value) }.`)
    }

    case TYPES.NUMBER: {
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          throw new ErrorGeneric(ERR.BAD_REQUEST,
              `Field "${ prop.key }" expects a number, but got ${ describe(value) }.`)
        }
        return value
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value)
        if (Number.isFinite(n)) return n
      }
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Field "${ prop.key }" expects a number, but got ${ describe(value) }.`)
    }

    case TYPES.BOOLEAN: {
      if (typeof value === 'boolean') return value
      if (value === 1) return true
      if (value === 0) return false
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase()
        if (v === 'true' || v === '1') return true
        if (v === 'false' || v === '0') return false
      }
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Field "${ prop.key }" expects true or false, but got ${ describe(value) }.`)
    }

    case TYPES.DATE: {
      try {
        return dates.parse(value)
      } catch (err) {
        throw new ErrorGeneric(ERR.BAD_REQUEST, `Field "${ prop.key }": ${ err.text || err.message }`)
      }
    }

    case TYPES.ARRAY: {
      if (!Array.isArray(value)) {
        throw new ErrorGeneric(ERR.BAD_REQUEST,
            `Field "${ prop.key }" expects a list, but got ${ describe(value) }.`)
      }
      for (let i = 0; i < value.length; i++) {
        const el = value[i]
        if (el === null || el === undefined) continue
        if (typeof el !== 'string') {
          throw new ErrorGeneric(ERR.BAD_REQUEST,
              `Field "${ prop.key }" expects a list of strings, but element [${ i }] is ${ describe(el) }.`)
        }
      }
      return value
    }

    case TYPES.ENUM: {
      const opts = prop.rules?.options || []
      const ok = opts.some(o => o === value || o?.value === value)
      if (!ok) {
        const allowed = opts.map(o => o?.value ?? o).join(', ')
        throw new ErrorGeneric(ERR.BAD_REQUEST,
            `Field "${ prop.key }" must be one of: ${ allowed }. Got ${ describe(value) }.`)
      }
      return value
    }

    case TYPES.REFERENCE: {
      if (typeof value === 'string') return value
      if (typeof value === 'number' && Number.isFinite(value)) return String(value)
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Field "${ prop.key }" expects a reference id, but got ${ describe(value) }.`)
    }

    case TYPES.SUBSET: {
      if (!Array.isArray(value)) {
        throw new ErrorGeneric(ERR.BAD_REQUEST,
            `Field "${ prop.key }" expects a list of ids, but got ${ describe(value) }.`)
      }
      for (let i = 0; i < value.length; i++) {
        const el = value[i]
        if (el === null || el === undefined) continue
        if (typeof el !== 'string') {
          throw new ErrorGeneric(ERR.BAD_REQUEST,
              `Field "${ prop.key }" expects a list of ids, but element [${ i }] is ${ describe(el) }.`)
        }
      }
      return value
    }

    default:
      return value
  }
}

function describe (value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `a list (${ value.length } item${ value.length === 1 ? '' : 's' })`
  if (value instanceof Date) return 'an invalid date'
  const t = typeof value
  if (t === 'object') return 'an object'
  if (t === 'number') return Number.isNaN(value) ? 'NaN' : `the number ${ value }`
  if (t === 'string') return `the text "${ value.length > 30 ? value.slice(0, 30) + '…' : value }"`
  if (t === 'boolean') return `the boolean ${ value }`
  return `a ${ t }`
}

/** P4 — "", null and an absent key are all "no value" (→ default on create, clear on update). */
function isNoValue (v) {
  return v === '' || v === null || v === undefined
}

/**
 * P1 — reject input keys that are not schema fields, naming the closest match.
 * A typo'd field is the most common weak-model mistake; a silent drop hides data
 * loss, a naming error lets the model retry in one step.
 */
function assertKnownKeys (schema, input) {
  const known = schema.props.map(p => p.key)
  const set = new Set(known)
  for (const k of Object.keys(input)) {
    if (k === 'id' || set.has(k)) continue
    const hint = closestKey(k, known)
    throw new ErrorGeneric(ERR.BAD_REQUEST,
        `Unknown field "${ k }". Valid fields: ${ known.join(', ') || '(none)' }.` +
        (hint ? ` Did you mean "${ hint }"?` : ''))
  }
}

/**
 * P3 — required fields must hold a value. A field is required when
 * `rules.required === true`, or when it is the `displayProp` and not explicitly
 * opted out (`rules.required === false`) — so a row can't be created blank-labelled.
 * `keys` (update) limits the check to the touched fields.
 */
function assertRequired (schema, body, keys = null) {
  for (const prop of schema.props) {
    if (keys && !keys.has(prop.key)) continue
    const required = prop.rules?.required === true ||
        (schema.displayProp === prop.key && prop.rules?.required !== false)
    if (!required) continue
    const v = body[prop.key]
    if (isNoValue(v) || (Array.isArray(v) && v.length === 0)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST, `Field "${ prop.key }" is required and cannot be empty.`)
    }
  }
}

function closestKey (input, keys) {
  let best = null, bestD = Infinity
  const lo = input.toLowerCase()
  for (const k of keys) {
    const d = editDistance(lo, k.toLowerCase())
    if (d < bestD) { bestD = d; best = k }
  }
  return bestD <= Math.max(2, Math.floor(input.length / 3)) ? best : null
}

function editDistance (a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [ i ]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[n]
}

function buildEntity (schema, input) {
  const out = {}
  for (const prop of schema.props) {
    const raw = input[prop.key]
    out[prop.key] = isNoValue(raw) ? defaultFor(prop) : coerce(prop, raw)
  }
  return out
}

/**
 * Coerce only the keys present in `patch` into a fresh staging object, so a
 * failed validation never half-mutates the live entity. A present "no value"
 * (""/null) clears the field. Returns { values, keys }.
 */
function stagePatch (schema, patch) {
  const values = {}
  const keys = new Set()
  for (const prop of schema.props) {
    const raw = patch[prop.key]
    if (raw === undefined) continue                          // absent / explicit undefined → leave intact
    values[prop.key] = (raw === '' || raw === null) ? (prop.type === TYPES.ARRAY || prop.type === TYPES.SUBSET ? [] : null) : coerce(prop, raw)  // P4: ""/null clear (list types → [])
    keys.add(prop.key)
  }
  return { values, keys }
}

/**
 * Referential integrity — reference/subset fields hold ids of rows that exist
 * in the target collection. Strict on the write path: a missing target
 * collection or an unknown id is a BAD_REQUEST. `onlyKeys` (update) limits the
 * check to the touched props; null (create) checks everything in `values`.
 */
function validateRefs (schema, values, dataset, onlyKeys = null, self = null) {
  for (const prop of schema.props) {
    if (prop.type !== TYPES.REFERENCE && prop.type !== TYPES.SUBSET) continue
    if (onlyKeys && !onlyKeys.has(prop.key)) continue
    const ref = prop.rules?.referenceTo
    if (!ref) continue
    const v = values[prop.key]
    if (v === null || v === undefined) continue
    const list = Array.isArray(v) ? v : [ v ]
    if (!list.some(id => id !== null && id !== undefined)) continue
    if (!dataset.has(ref)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Field "${ prop.key }" references collection "${ ref }", which does not exist.`)
    }
    const target = dataset.collection(ref)
    for (const id of list) {
      if (id === null || id === undefined) continue
      // No self-loops: a same-collection field may not hold the row's own id.
      // (Only reachable on update — on create the id isn't assigned yet.)
      if (self && ref === self.collection && id === self.id) {
        throw new ErrorGeneric(ERR.BAD_REQUEST,
            `Field "${ prop.key }" cannot reference the row's own id "${ id }" — a row may not reference itself.`)
      }
      if (!target._map.has(id)) {
        throw new ErrorGeneric(ERR.BAD_REQUEST,
            `Field "${ prop.key }" got "${ id }", which is not an id in "${ ref }". ` +
            `References take ids — use db_query on "${ ref }" to find one.`)
      }
    }
  }
}

/**
 * A reference/subset field's default must itself point to a real row — the same
 * strictness the row API applies, so add_field/update_field can't seed a dangling
 * default into every row. Reuses validateRefs for identical errors.
 */
function assertRefDef (prop, dataset) {
  if (prop.type !== TYPES.REFERENCE && prop.type !== TYPES.SUBSET) return
  if (prop.def === undefined || prop.def === null || prop.def === '') return
  const value = prop.type === TYPES.SUBSET ? (Array.isArray(prop.def) ? prop.def : [ prop.def ]) : prop.def
  validateRefs({ props: [ prop ] }, { [ prop.key ]: value }, dataset)
}

/**
 * Drop reference/subset ids that don't point to a live row (or hold the row's own
 * id). Used by migration: pre-existing values reach a newly ref-typed field
 * without passing validateRefs, so clear them rather than reject — you can't
 * refuse data that already exists. Returns true if it changed the value.
 */
function clearDanglingRefs (item, prop, collectionName, dataset) {
  const ref = prop.rules?.referenceTo
  const valid = (id) => id != null && !!ref && dataset.has(ref)
      && dataset.collection(ref)._map.has(id)
      && !(ref === collectionName && id === item.id)
  if (prop.type === TYPES.REFERENCE) {
    const v = item[prop.key]
    if (v != null && !valid(v)) { item[prop.key] = null; return true }
    return false
  }
  if (prop.type === TYPES.SUBSET) {
    const v = item[prop.key]
    if (!Array.isArray(v)) return false
    const kept = v.filter(valid)
    if (kept.length !== v.length) { item[prop.key] = kept; return true }
  }
  return false
}

function migrateItems (collection, newSchema, renames = [], dataset = null) {
  const newKeys = new Set(newSchema.props.map(p => p.key))

  let removed = 0, added = 0, coerced = 0, reset = 0, renamed = 0, cleared = 0

  // rename pass: carry old values to their new key before drop/add/coerce
  for (const { from, to } of renames) {
    for (const item of collection._array) {
      if (Object.prototype.hasOwnProperty.call(item, from)) item[to] = item[from]
    }
    renamed++
  }

  for (const item of collection._array) {
    for (const key of Object.keys(item)) {
      if (key === 'id') continue
      if (!newKeys.has(key)) {
        delete item[key]
        removed++
      }
    }

    for (const prop of newSchema.props) {
      const cur = item[prop.key]
      if (cur === undefined) {
        item[prop.key] = defaultFor(prop)
        added++
      } else if (cur !== null) {
        try {
          const next = coerce(prop, cur)
          if (next !== cur) {
            item[prop.key] = next
            coerced++
          }
        } catch {
          item[prop.key] = defaultFor(prop)
          reset++
        }
      }
      // Referential integrity on the schema-write path: a value that reached a
      // reference/subset field this way never saw validateRefs — drop ids that
      // don't point to a real row (the add_field-default / retype hole).
      if (dataset && (prop.type === TYPES.REFERENCE || prop.type === TYPES.SUBSET)) {
        if (clearDanglingRefs(item, prop, collection.name, dataset)) cleared++
      }
    }
  }

  return { removed, added, coerced, reset, renamed, cleared }
}

const FILTER_OPS = new Set([ 'eq', 'in', 'lt', 'gt', 'contains', 'starts', 'has', 'hasAny' ])

function coerceFilters (schema, filterList) {
  if (!filterList) return null
  if (!Array.isArray(filterList)) {
    throw new ErrorGeneric(ERR.BAD_REQUEST, 'Filters must be an array of { key, op, value }.')
  }

  return filterList.map((f) => {
    if (!f || typeof f.key !== 'string') {
      throw new ErrorGeneric(ERR.BAD_REQUEST, 'Each filter must be an object with a string "key".')
    }
    if (!FILTER_OPS.has(f.op)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Unknown filter operator "${ f.op }" on field "${ f.key }". Allowed: ${ [ ...FILTER_OPS ].join(', ') }.`)
    }
    const prop = schema.props.find(p => p.key === f.key)
    if (!prop) {
      throw new ErrorGeneric(ERR.BAD_REQUEST, `Filter references unknown field "${ f.key }".`)
    }

    return { key: f.key, op: f.op, value: coerceFilterValue(prop, f.op, f.value) }
  })
}

function coerceFilterValue (prop, op, value) {
  switch (op) {
    case 'contains':
    case 'starts':
      return String(value ?? '')

    case 'has':
      return value == null ? value : String(value)

    case 'hasAny':
      if (!Array.isArray(value)) {
        throw new ErrorGeneric(ERR.BAD_REQUEST, `Filter "${ prop.key } hasAny ..." needs an array value.`)
      }
      return value.map(v => (v == null ? v : String(v)))

    case 'in':
      if (!Array.isArray(value)) {
        throw new ErrorGeneric(ERR.BAD_REQUEST, `Filter "${ prop.key } in ..." needs an array value.`)
      }
      return value.map(v => coerce(prop, v))

    case 'eq':
    case 'lt':
    case 'gt':
    default:
      return coerce(prop, value)
  }
}

function buildRefs (rows, schema, dataset) {
  if (!rows.length) return {}

  const need = {}
  for (const prop of schema.props) {
    const ref = prop.rules?.referenceTo
    if (!ref) continue
    if (prop.type !== TYPES.REFERENCE && prop.type !== TYPES.SUBSET) continue
    const bucket = need[ref] || (need[ref] = new Set())
    for (const row of rows) {
      const v = row[prop.key]
      if (Array.isArray(v)) v.forEach(id => id != null && bucket.add(id))
      else if (v != null) bucket.add(v)
    }
  }

  const out = {}
  for (const [ targetName, idSet ] of Object.entries(need)) {
    if (!dataset.has(targetName)) continue
    const target = dataset.collection(targetName)
    const list = []
    for (const id of idSet) {
      const entity = target._map.get(id)
      if (entity) list.push({ id, label: filters.displayLabel(entity, target.schema) })
    }
    out[targetName] = list
  }
  return out
}

function coerceSort (schema, sort) {
  if (sort == null) return null
  if (typeof sort !== 'object' || Array.isArray(sort) || typeof sort.key !== 'string') {
    throw new ErrorGeneric(ERR.BAD_REQUEST, 'Sort must be an object with a string "key".')
  }
  const dir = sort.dir === undefined ? 'asc' : sort.dir
  if (dir !== 'asc' && dir !== 'desc') {
    throw new ErrorGeneric(ERR.BAD_REQUEST, `Sort dir for "${ sort.key }" must be "asc" or "desc", got "${ sort.dir }".`)
  }
  if (sort.key === 'id') return { key: 'id', dir, type: TYPES.NUMBER, prop: null }
  const prop = schema.props.find(p => p.key === sort.key)
  if (!prop) throw new ErrorGeneric(ERR.BAD_REQUEST, `Sort references unknown field "${ sort.key }".`)
  // Every field is sortable: reference → target label, list → element count (makeComparator).
  return { key: sort.key, dir, type: prop.type, prop }
}

const idCounter = (id) => { const d = ids.decode(id); return d ? d.counter : NaN }

/**
 * Per-row sort key:
 *  - id           → numeric counter (the monotonic backbone, not lexicographic —
 *                   "<prefix>-<counter>" would mis-sort -10 before -2)
 *  - reference    → display label of the target row; empty/dangling → null (edge)
 *  - subset/array → element count
 *  - else         → the raw value
 */
function sortKeyOf (sortSpec, dataset) {
  const { key, prop } = sortSpec
  if (key === 'id') return (row) => idCounter(row.id)
  if (prop?.type === TYPES.SUBSET || prop?.type === TYPES.ARRAY) {
    return (row) => (Array.isArray(row[key]) ? row[key].length : 0)
  }
  if (prop?.type === TYPES.REFERENCE) {
    const ref = prop.rules?.referenceTo
    const target = ref && dataset.has(ref) ? dataset.collection(ref) : null
    return (row) => {
      const id = row[key]
      if (id == null) return null
      const entity = target?._map.get(id)
      return entity ? filters.displayLabel(entity, target.schema) : null
    }
  }
  return (row) => row[key]
}

function makeComparator (sortSpec, dataset) {
  const { key, dir, type, prop } = sortSpec
  const flip = dir === 'desc' ? -1 : 1
  const get  = sortKeyOf(sortSpec, dataset)
  // reference sorts by its (string) label; id and list-counts are numeric.
  const cmpType = prop?.type === TYPES.REFERENCE ? TYPES.STRING
      : (key === 'id' || prop?.type === TYPES.SUBSET || prop?.type === TYPES.ARRAY) ? TYPES.NUMBER
      : type
  return (a, b) => flip * compareValues(cmpType, get(a), get(b))
}

function compareValues (type, av, bv) {
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  if (type === TYPES.NUMBER)  return Number(av) - Number(bv)
  if (type === TYPES.BOOLEAN) return av === bv ? 0 : (av ? 1 : -1)
  if (av < bv) return -1
  if (av > bv) return 1
  return 0
}

function validatePagination (offset, limit) {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ErrorGeneric(ERR.BAD_REQUEST,
        `Pagination "offset" must be a non-negative integer, got ${ describe(offset) }.`)
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new ErrorGeneric(ERR.BAD_REQUEST,
        `Pagination "limit" must be a positive integer, got ${ describe(limit) }.`)
  }
}

function paginate (array, { offset, limit, filterList, sortSpec, dataset }) {
  const hasFilters = filterList && filterList.length > 0
  const hasSort    = !!sortSpec

  let working
  if (hasFilters) {
    const predicates = filters.buildPredicates(filterList)
    working = []
    for (const e of array) {
      let pass = true
      for (let j = 0; j < predicates.length; j++) if (!predicates[j](e)) { pass = false; break }
      if (pass) working.push(e)
    }
  } else {
    working = array
  }

  if (hasSort) {
    const cmp = makeComparator(sortSpec, dataset)
    working = working === array ? array.toSorted(cmp) : working.sort(cmp)
  }

  const total = working.length
  const data  = working.slice(offset, offset + limit)

  return {
    data,
    offset,
    limit,
    total,
    hasMore: offset + data.length < total,
  }
}

function statsPathFor (dataPath) {
  const dir = path.dirname(dataPath)
  const base = path.basename(dataPath, '.json')
  return path.join(dir, `${ base }${ STATS_SUFFIX }`)
}

async function readJSON (filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf-8'))
}

async function writeJSON (filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function tryUnlink (filePath) {
  try { await fs.unlink(filePath) } catch (err) { if (err.code !== 'ENOENT') throw err }
}

class Collection {
  constructor (dataset, name) {
    this._dataset = dataset
    this.name = name
    this.schema = null

    this._map = new Map()
    this._array = []
    this._iterator = 0
    this._changed = null
    this._autoSaveTimeout = null

    const sigCreated = new Sig()
    const sigUpdated = new Sig()
    const sigDeleted = new Sig()
    this._sigs = { created: sigCreated, updated: sigUpdated, deleted: sigDeleted }

    this.when = {
      created: sigCreated.extractOn(),
      updated: sigUpdated.extractOn(),
      deleted: sigDeleted.extractOn(),
    }

    this._dataPath = path.join(dataset._dataDir, `${ name }.json`)
    this._statsPath = statsPathFor(this._dataPath)
  }

  get total () { return this._array.length }
  get size () { return this._array.length }
  get iterator () { return this._iterator }
  get changed () { return this._changed }

  has (id) { return this._map.has(id) }
  find (predicate) { return this._array.filter(predicate) }
  findOne (predicate) {
    for (const e of this._array) if (predicate(e)) return e
    return null
  }
  nextId () { return ids.encode(this.schema.idgen.prefix, ++this._iterator) }

  list ({ offset = 0, limit = DEFAULT_LIMIT, filters: filterList = null, sort = null } = {}) {
    validatePagination(offset, limit)
    const coercedFilters = coerceFilters(this.schema, filterList)
    const coercedSort    = coerceSort(this.schema, sort)
    const result = paginate(this._array, {
      offset, limit,
      filterList: coercedFilters,
      sortSpec:   coercedSort,
      dataset:    this._dataset,
    })
    result.refs = buildRefs(result.data, this.schema, this._dataset)
    return result
  }

  get (id) {
    if (!id) throw new ErrorGeneric(ERR.BAD_REQUEST, `An id is required to read from "${ this.name }".`)
    const item = this._map.get(id)
    if (!item) throw new ErrorGeneric(ERR.NOT_FOUND, `Item "${ id }" not found in collection "${ this.name }".`)
    return { item, refs: buildRefs([ item ], this.schema, this._dataset) }
  }

  create (data = {}) {
    assertKnownKeys(this.schema, data)
    const body = buildEntity(this.schema, data)
    assertRequired(this.schema, body)
    validateRefs(this.schema, body, this._dataset)
    const entity = { id: this.nextId(), ...body }
    this._map.set(entity.id, entity)
    this._array.push(entity)
    this._markDirty()
    const snapshot = { ...entity }
    this._sigs.created.emit(snapshot)
    this._dataset._sigs.itemCreated.emit({ collection: this.name, item: snapshot })
    return { item: entity }
  }

  /** Bulk insert — validate every row first, then commit all (all-or-nothing). */
  createMany (rows = []) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new ErrorGeneric(ERR.BAD_REQUEST, '"rows" must be a non-empty array of objects.')
    }
    const bodies = rows.map((data, i) => {
      try {
        assertKnownKeys(this.schema, data || {})
        const body = buildEntity(this.schema, data || {})
        assertRequired(this.schema, body)
        validateRefs(this.schema, body, this._dataset)
        return body
      } catch (err) {
        throw new ErrorGeneric(err.code || ERR.BAD_REQUEST, `rows[${ i }]: ${ err.text || err.message }`)
      }
    })
    const items = bodies.map((body) => {
      const entity = { id: this.nextId(), ...body }
      this._map.set(entity.id, entity)
      this._array.push(entity)
      return entity
    })
    this._markDirty()
    for (const entity of items) {
      const snapshot = { ...entity }
      this._sigs.created.emit(snapshot)
      this._dataset._sigs.itemCreated.emit({ collection: this.name, item: snapshot })
    }
    return { items }
  }

  update (id, patch = {}) {
    if (!id) throw new ErrorGeneric(ERR.BAD_REQUEST, `An id is required to update an item in "${ this.name }".`)
    const item = this._map.get(id)
    if (!item) throw new ErrorGeneric(ERR.NOT_FOUND, `Item "${ id }" not found in collection "${ this.name }".`)
    assertKnownKeys(this.schema, patch)
    const { values, keys } = stagePatch(this.schema, patch)
    assertRequired(this.schema, values, keys)
    validateRefs(this.schema, values, this._dataset, keys, { collection: this.name, id })
    Object.assign(item, values)
    this._markDirty()
    const snapshot = { ...item }
    this._sigs.updated.emit(snapshot)
    this._dataset._sigs.itemUpdated.emit({ collection: this.name, item: snapshot })
    return { item }
  }

  delete (id, { force = false } = {}) {
    if (!id) throw new ErrorGeneric(ERR.BAD_REQUEST, `An id is required to delete an item from "${ this.name }".`)
    if (!this._map.has(id)) throw new ErrorGeneric(ERR.NOT_FOUND, `Item "${ id }" not found in collection "${ this.name }".`)

    // Referential integrity on delete mirrors the write side: a row other rows
    // point at can't just leave dangling ids behind. Without force, refuse and
    // name the referrers; with force, delete and clear those references.
    const inbound = this._dataset.inboundRefs(this.name, id)
    if (inbound.length && !force) {
      const detail = inbound.map(r => `${ r.collection }.${ r.key } (${ r.count })`).join(', ')
      throw new ErrorGeneric(ERR.CONFLICT,
          `Cannot delete "${ id }" from "${ this.name }" — referenced by ${ detail }. ` +
          `Pass force:true to delete it and clear those references.`)
    }

    const idx = this._array.findIndex(e => e.id === id)
    if (idx !== -1) this._array.splice(idx, 1)
    this._map.delete(id)
    this._markDirty()
    this._sigs.deleted.emit(id)
    this._dataset._sigs.itemDeleted.emit({ collection: this.name, id })

    const cleared = inbound.length ? this._clearInboundRefs(id) : []
    return { ok: true, cleared }
  }

  /** Null/drop every reference to `id` across collections that point at this one. */
  _clearInboundRefs (id) {
    const cleared = []
    for (const { collection, key, isArray } of this._dataset.inboundRefFields(this.name)) {
      const col = this._dataset.collection(collection)
      let touched = false
      for (const row of col._array) {
        let changed = false
        if (isArray) {
          if (Array.isArray(row[key]) && row[key].includes(id)) {
            row[key] = row[key].filter(x => x !== id)
            changed = true
          }
        } else if (row[key] === id) {
          row[key] = null
          changed = true
        }
        if (!changed) continue
        cleared.push({ collection, id: row.id, key })
        touched = true
        col._sigs.updated.emit({ ...row })
        this._dataset._sigs.itemUpdated.emit({ collection, item: { ...row } })
      }
      if (touched) col._markDirty()
    }
    return cleared
  }

  /** Bulk delete by id — all-or-nothing. Same ref guard as delete: blocked unless force, then cascade-null. */
  deleteMany (ids = [], { force = false } = {}) {
    if (!Array.isArray(ids) || !ids.length) {
      throw new ErrorGeneric(ERR.BAD_REQUEST, '"ids" must be a non-empty array.')
    }
    for (const id of ids) {
      if (!this._map.has(id)) throw new ErrorGeneric(ERR.NOT_FOUND, `Item "${ id }" not found in collection "${ this.name }".`)
    }
    const blocked = ids
        .map(id => ({ id, inbound: this._dataset.inboundRefs(this.name, id) }))
        .filter(x => x.inbound.length)
    if (blocked.length && !force) {
      const detail = blocked.map(b => `${ b.id } (${ b.inbound.map(r => `${ r.collection }.${ r.key }`).join(', ') })`).join('; ')
      throw new ErrorGeneric(ERR.CONFLICT,
          `Cannot delete ${ blocked.length } referenced row(s) from "${ this.name }": ${ detail }. ` +
          `Pass force:true to delete them and clear those references.`)
    }
    const cleared = []
    for (const id of ids) {
      const idx = this._array.findIndex(e => e.id === id)
      if (idx !== -1) this._array.splice(idx, 1)
      this._map.delete(id)
      this._sigs.deleted.emit(id)
      this._dataset._sigs.itemDeleted.emit({ collection: this.name, id })
      cleared.push(...this._clearInboundRefs(id))
    }
    this._markDirty()
    return { deleted: ids, cleared }
  }

  async _load () {
    let data = []
    try {
      data = await readJSON(this._dataPath)
      if (!Array.isArray(data)) throw new Error(`${ this._dataPath }: data must be an array`)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }

    this._map.clear()
    this._array.length = 0
    for (const item of data) {
      if (!item?.id) throw new Error(`${ this._dataPath }: every entity must have an id`)
      this._map.set(item.id, item)
      this._array.push(item)
    }

    await this._loadStats()
    log(`Loaded ${ this.size } items from ${ path.basename(this._dataPath) } (iterator=${ this._iterator })`)
  }

  async _loadStats () {
    try {
      const stats = await readJSON(this._statsPath)
      this._iterator = Number.isFinite(stats?.iterator) ? stats.iterator : 0
      this._changed = typeof stats?.changed === 'string' ? stats.changed : null
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      this._iterator = 0
      this._changed = null
    }
  }

  async _save () {
    await writeJSON(this._dataPath, this._array)
    await writeJSON(this._statsPath, { iterator: this._iterator, changed: this._changed })
    log(`Saved ${ this.size } items to ${ path.basename(this._dataPath) }`)
  }

  async _destroy () {
    if (this._autoSaveTimeout) {
      clearTimeout(this._autoSaveTimeout)
      this._autoSaveTimeout = null
    }
    await tryUnlink(this._dataPath)
    await tryUnlink(this._statsPath)
  }

  async _flush () {
    if (!this._autoSaveTimeout) return
    clearTimeout(this._autoSaveTimeout)
    this._autoSaveTimeout = null
    await this._save()
  }

  _markDirty (delay = 1000) {
    this._changed = new Date().toISOString()
    if (this._autoSaveTimeout) clearTimeout(this._autoSaveTimeout)
    this._autoSaveTimeout = setTimeout(() => this._save().catch(error), delay)
  }
}

class Schemas {
  constructor (dataset) {
    this._db = dataset
  }

  list () {
    return [ ...this._db._entries.entries() ].map(([ name, { schema } ]) => ({ name, schema }))
  }

  get (name) {
    if (!name) throw new ErrorGeneric(ERR.BAD_REQUEST, 'A collection name is required.')
    const entry = this._db._entries.get(name)
    if (!entry) throw new ErrorGeneric(ERR.NOT_FOUND, `Collection "${ name }" does not exist.`)
    return { name, schema: entry.schema }
  }

  async create (name, schema) {
    assertValidName(name)
    const norm = sanitizeSchema(name, schema)
    if (this._db._entries.has(name)) {
      throw new ErrorGeneric(ERR.CONFLICT, `Collection "${ name }" already exists — pick a different name.`)
    }
    this._assertUniquePrefix(name, norm.idgen.prefix)
    await writeJSON(path.join(this._db._dataDir, `${ name }${ SCHEMA_SUFFIX }`), norm)
    await this._db._loadOne(name, norm)
    this._db._sigs.schemaCreated.emit({ name, schema: norm })
    log(`Created collection "${ name }"`)
    return { name, schema: norm }
  }

  async update (name, schema, renames = []) {
    assertValidName(name)
    return this._migrateAndPersist(name, schema, renames)
  }

  /** Validate + migrate rows (optionally renaming columns) + persist. Shared by every field op + update. */
  async _migrateAndPersist (name, schema, renames = []) {
    schema = sanitizeSchema(name, schema)
    const entry = this._req(name)

    const report = migrateItems(entry.collection, schema, renames, this._db)

    if (report.removed || report.added || report.coerced || report.reset || report.renamed || report.cleared) {
      entry.collection._changed = new Date().toISOString()
      if (entry.collection._autoSaveTimeout) {
        clearTimeout(entry.collection._autoSaveTimeout)
        entry.collection._autoSaveTimeout = null
      }
      await entry.collection._save()
    }

    await writeJSON(path.join(this._db._dataDir, `${ name }${ SCHEMA_SUFFIX }`), schema)
    entry.schema = schema
    entry.collection.schema = schema

    this._db._sigs.schemaUpdated.emit({ name, schema })
    log(`Migrated "${ name }" (${ entry.collection._array.length } item(s)): ` +
        `dropped ${ report.removed }, added ${ report.added }, coerced ${ report.coerced }, reset ${ report.reset }, renamed ${ report.renamed }, cleared ${ report.cleared }`)
    return { name, schema, report }
  }

  _req (name) {
    if (!name) throw new ErrorGeneric(ERR.BAD_REQUEST, 'A collection name is required.')
    const entry = this._db._entries.get(name)
    if (!entry) throw new ErrorGeneric(ERR.NOT_FOUND, `Collection "${ name }" does not exist.`)
    return entry
  }

  // -- atomic metadata ops ----------------------------------------------------

  /** Id prefixes must be unique across collections so an id (and its doc token) maps to one collection. */
  _assertUniquePrefix (name, prefix) {
    for (const [ n, entry ] of this._db._entries) {
      if (n !== name && entry.schema.idgen?.prefix === prefix) {
        throw new ErrorGeneric(ERR.CONFLICT,
            `Id prefix "${ prefix }" is already used by collection "${ n }". Prefixes must be unique across collections.`)
      }
    }
  }

  /**
   * Change the collection's id prefix (Storage B). Rewrites every row id and
   * every inbound reference/subset value in one atomic sweep — the counter is
   * preserved, so the old→new id mapping is bijective. The rare, deliberate
   * cost that buys one id representation everywhere (see ids.js).
   */
  async setIdgen (name, prefix) {
    const entry = this._req(name)
    if (!ids.isValidPrefix(prefix)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST,
          `Invalid id prefix "${ prefix }" — no spaces, no leading digit.`)
    }
    this._assertUniquePrefix(name, prefix)
    const col = entry.collection
    const old = entry.schema.idgen.prefix
    if (prefix === old) return this.get(name)

    // Build the full old→new remap up front, validating every id is decodable
    // before mutating anything (all-or-nothing).
    const remap = new Map()
    for (const row of col._array) {
      const dec = ids.decode(row.id)
      if (!dec) throw new ErrorGeneric(ERR.CONFLICT, `Cannot re-prefix "${ name }": id "${ row.id }" is not a prefixed id.`)
      remap.set(row.id, ids.encode(prefix, dec.counter))
    }

    // rewrite own ids (array values + re-key the map)
    col._map.clear()
    for (const row of col._array) {
      row.id = remap.get(row.id)
      col._map.set(row.id, row)
    }

    // rewrite inbound references across collections (includes self-references)
    const touched = []
    for (const { collection, key, isArray } of this._db.inboundRefFields(name)) {
      const ref = this._db.collection(collection)
      let changed = false
      for (const row of ref._array) {
        if (isArray) {
          if (Array.isArray(row[key]) && row[key].some(v => remap.has(v))) {
            row[key] = row[key].map(v => remap.get(v) ?? v)
            changed = true
          }
        } else if (remap.has(row[key])) {
          row[key] = remap.get(row[key])
          changed = true
        }
        if (!changed) continue
        ref._sigs.updated.emit({ ...row })
        this._db._sigs.itemUpdated.emit({ collection, item: { ...row } })
        changed = false
        if (collection !== name && !touched.includes(ref)) touched.push(ref)
      }
    }

    entry.schema.idgen = { prefix }

    // persist own collection (ids changed) + every touched referrer + the schema
    for (const c of [ col, ...touched ]) {
      c._changed = new Date().toISOString()
      if (c._autoSaveTimeout) { clearTimeout(c._autoSaveTimeout); c._autoSaveTimeout = null }
      await c._save()
    }
    await this._persistSchema(name, entry.schema)
    log(`Re-prefixed "${ name }" ${ old } → ${ prefix } (${ col._array.length } id(s)${ touched.length ? `, ${ touched.length } referrer(s)` : '' })`)
    return this.get(name)
  }

  async setDescription (name, value) {
    const entry = this._req(name)
    entry.schema.description = value ?? ''
    await this._persistSchema(name, entry.schema)
    return this.get(name)
  }

  async setDisplayProp (name, value) {
    const entry = this._req(name)
    if (value && !entry.schema.props.some(p => p.key === value)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST, `displayProp "${ value }" is not a field of "${ name }".`)
    }
    if (value) entry.schema.displayProp = value
    else delete entry.schema.displayProp
    await this._persistSchema(name, entry.schema)
    return this.get(name)
  }

  // -- atomic field ops -------------------------------------------------------

  /** Add a new field; existing rows get its default. */
  async addField (name, field) {
    if (!field || typeof field.key !== 'string') {
      throw new ErrorGeneric(ERR.BAD_REQUEST, 'addField: a "field" with a string "key" is required.')
    }
    const entry = this._req(name)
    if (entry.schema.props.some(p => p.key === field.key)) {
      throw new ErrorGeneric(ERR.CONFLICT, `Field "${ field.key }" already exists in "${ name }".`)
    }
    const { field: norm, note } = normalizeFieldFormat({ ...field })
    assertRefDef(norm, this._db)   // a reference/subset default must point to a real row
    const props = [ ...entry.schema.props.map(p => ({ ...p })), norm ]
    return this._applyFieldChange(name, props, [], note ? [ note ] : [])
  }

  /** Drop a field and its column data. */
  async removeField (name, key) {
    const entry = this._req(name)
    const i = entry.schema.props.findIndex(p => p.key === key)
    if (i === -1) throw new ErrorGeneric(ERR.BAD_REQUEST, `No field "${ key }" to remove in "${ name }".`)
    const props = entry.schema.props.map(p => ({ ...p }))
    props.splice(i, 1)
    return this._applyFieldChange(name, props, [])
  }

  /** Change a field in place (type/format/def/rules). Cannot change the key — use renameField. */
  async updateField (name, key, changes = {}) {
    const entry = this._req(name)
    if (!entry.schema.props.some(p => p.key === key)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST, `No field "${ key }" to update in "${ name }".`)
    }
    if (changes.key !== undefined && changes.key !== key) {
      throw new ErrorGeneric(ERR.BAD_REQUEST, 'updateField cannot change the key — use renameField.')
    }
    const props = entry.schema.props.map(p => (p.key === key ? { ...p, ...changes, key } : { ...p }))
    const i = props.findIndex(p => p.key === key)
    const { field: norm, note } = normalizeFieldFormat(props[i])
    props[i] = norm
    assertRefDef(norm, this._db)   // a reference/subset default must point to a real row
    return this._applyFieldChange(name, props, [], note ? [ note ] : [])
  }

  /** Rename a field's key, preserving every row's value. */
  async renameField (name, key, to) {
    if (typeof to !== 'string' || !to) throw new ErrorGeneric(ERR.BAD_REQUEST, 'renameField: "to" must be a non-empty string.')
    const entry = this._req(name)
    if (!entry.schema.props.some(p => p.key === key)) {
      throw new ErrorGeneric(ERR.BAD_REQUEST, `No field "${ key }" to rename in "${ name }".`)
    }
    if (entry.schema.props.some(p => p.key === to)) {
      throw new ErrorGeneric(ERR.CONFLICT, `Field "${ to }" already exists in "${ name }".`)
    }
    const props = entry.schema.props.map(p => (p.key === key ? { ...p, key: to } : { ...p }))
    return this._applyFieldChange(name, props, [ { from: key, to } ])
  }

  /** Shared tail for every field mutation: keep displayProp valid, migrate rows, persist. */
  async _applyFieldChange (name, props, renames, notes = []) {
    const entry = this._req(name)
    let displayProp = entry.schema.displayProp
    for (const { from, to } of renames) if (displayProp === from) displayProp = to
    if (displayProp && !props.some(p => p.key === displayProp)) displayProp = undefined

    const finalSchema = { ...entry.schema, props }
    if (displayProp) finalSchema.displayProp = displayProp
    else delete finalSchema.displayProp

    const { report } = await this._migrateAndPersist(name, finalSchema, renames)
    const allNotes = report?.cleared
      ? [ ...notes, `Cleared ${ report.cleared } value(s) that did not point to a real row.` ]
      : notes
    return { ...this.get(name), notes: allNotes }
  }

  async _persistSchema (name, schema) {
    schema = sanitizeSchema(name, schema)
    await writeJSON(path.join(this._db._dataDir, `${ name }${ SCHEMA_SUFFIX }`), schema)
    this._db._sigs.schemaUpdated.emit({ name, schema })
    return { name, schema }
  }

  async delete (name, { force = false } = {}) {
    assertValidName(name)
    const entry = this._db._entries.get(name)
    if (!entry) throw new ErrorGeneric(ERR.NOT_FOUND, `Cannot delete schema — collection "${ name }" does not exist.`)

    // other collections pointing at this one would be left holding dangling ids
    const refs = this._db.inboundRefFields(name).filter(f => f.collection !== name)
    if (refs.length && !force) {
      const detail = refs.map(r => `${ r.collection }.${ r.key }`).join(', ')
      throw new ErrorGeneric(ERR.CONFLICT,
          `Cannot delete collection "${ name }" — referenced by ${ detail }. ` +
          `Pass force:true to delete it and clear those references.`)
    }
    const cleared = refs.length ? this._db.clearReferencingFields(refs) : []

    await entry.collection._destroy()
    await tryUnlink(path.join(this._db._dataDir, `${ name }${ SCHEMA_SUFFIX }`))
    this._db._entries.delete(name)
    this._db._sigs.schemaDeleted.emit({ name })
    log(`Deleted collection "${ name }"${ cleared.length ? ` (cleared ${ cleared.length } referencing value(s))` : '' }`)
    return { name, cleared }
  }
}

export class Dataset {
  constructor (dataDir) {
    if (!dataDir) throw new Error('Dataset: dataDir is required')
    this._dataDir = dataDir
    this._entries = new Map()
    this.schemas = new Schemas(this)

    const sigs = {
      itemCreated:   new Sig(),
      itemUpdated:   new Sig(),
      itemDeleted:   new Sig(),
      schemaCreated: new Sig(),
      schemaUpdated: new Sig(),
      schemaDeleted: new Sig(),
    }
    this._sigs = sigs

    this.when = {
      itemCreated:   sigs.itemCreated.extractOn(),
      itemUpdated:   sigs.itemUpdated.extractOn(),
      itemDeleted:   sigs.itemDeleted.extractOn(),
      schemaCreated: sigs.schemaCreated.extractOn(),
      schemaUpdated: sigs.schemaUpdated.extractOn(),
      schemaDeleted: sigs.schemaDeleted.extractOn(),
    }
  }

  get dataDir () { return this._dataDir }

  async open () {
    await fs.mkdir(this._dataDir, { recursive: true })
    const files = await fs.readdir(this._dataDir)
    const schemaFiles = files.filter(f => f.endsWith(SCHEMA_SUFFIX))
    log(`Scanning ${ this._dataDir } — found ${ schemaFiles.length } schema file(s)`)

    for (const f of schemaFiles) {
      const name = f.slice(0, -SCHEMA_SUFFIX.length)
      try {
        assertValidName(name)
        const schema = await readJSON(path.join(this._dataDir, f))
        await this._loadOne(name, schema)
      } catch (err) {
        warn(`Skipping "${ name }": ${ err.message || err }`)
      }
    }

    log(`Dataset open — ${ this._entries.size } collection(s): ${ [ ...this._entries.keys() ].join(', ') || '(none)' }`)
    return this
  }

  async close () {
    for (const { collection } of this._entries.values()) {
      try { await collection._flush() } catch (err) { error('close: flush failed for', collection.name, err) }
    }
    this._entries.clear()
    for (const sig of Object.values(this._sigs)) sig.wipe()
  }

  has (name) {
    return this._entries.has(name)
  }

  collection (name) {
    const entry = this._entries.get(name)
    if (!entry) throw new ErrorGeneric(ERR.NOT_FOUND, `Collection "${ name }" does not exist.`)
    return entry.collection
  }

  /** Every reference/subset field across all collections that points at `targetName`. */
  inboundRefFields (targetName) {
    const out = []
    for (const [ name, { schema } ] of this._entries) {
      for (const prop of schema.props) {
        if ((prop.type === TYPES.REFERENCE || prop.type === TYPES.SUBSET) && prop.rules?.referenceTo === targetName) {
          out.push({ collection: name, key: prop.key, isArray: prop.type === TYPES.SUBSET })
        }
      }
    }
    return out
  }

  /** Clear every value in the given referencing fields (their target is going away). */
  clearReferencingFields (refs) {
    const cleared = []
    for (const { collection, key, isArray } of refs) {
      const col = this.collection(collection)
      let touched = false
      for (const row of col._array) {
        const has = isArray ? (Array.isArray(row[key]) && row[key].length > 0) : (row[key] !== null && row[key] !== undefined)
        if (!has) continue
        row[key] = isArray ? [] : null
        cleared.push({ collection, id: row.id, key })
        touched = true
        col._sigs.updated.emit({ ...row })
        this._sigs.itemUpdated.emit({ collection, item: { ...row } })
      }
      if (touched) col._markDirty()
    }
    return cleared
  }

  /** Rows that reference id `id` in collection `targetName`: [{ collection, key, count }]. */
  inboundRefs (targetName, id) {
    const hits = []
    for (const { collection, key, isArray } of this.inboundRefFields(targetName)) {
      const col = this.collection(collection)
      let count = 0
      for (const row of col._array) {
        const v = row[key]
        if (isArray) { if (Array.isArray(v) && v.includes(id)) count++ }
        else if (v === id) count++
      }
      if (count) hits.push({ collection, key, count })
    }
    return hits
  }

  async _loadOne (name, schema) {
    const norm = sanitizeSchema(name, schema, { onLoad: true })   // served complete; on-disk legacy file left as-is (no heal)
    const col = new Collection(this, name)
    col.schema = norm
    await col._load()
    this._entries.set(name, { schema: norm, collection: col })
  }
}
