import { store }      from '../modules/store.js'
import { config }     from '../config.js'
import { ApiError }   from '../lib/api.js'
import { FieldType }  from '../lib/field-types.js'
import { createBus }  from '../lib/bus.js'

const bus = createBus('search')

const DEFAULT_LIMIT = 50

const fallback = new FieldType()

function getType (field) {
  return config.fields?.[field] || fallback
}

/**
 * Search entries by field filters.
 * @param {{ filters: Array, tags?: string[], project?: string, limit?: number }} body
 */
export async function handleSearch ({ filters, tags, project, limit } = {}) {
  const parts = []
  if (project) parts.push(`project: ${ project }`)
  if (tags?.length) parts.push(`tags: ${ tags.join(', ') }`)
  const ev = bus.op(`${ (filters || []).length } filters`, parts.length ? parts.join(', ') : null)

  if (!Array.isArray(filters) || filters.length === 0) {
    throw new ApiError(400, 'Missing required field: filters (array of {field, value, op?})')
  }

  for (const f of filters) {
    if (!f.field || f.value === undefined) {
      throw new ApiError(400, `Invalid filter: each must have "field" and "value"`)
    }
  }

  const maxResults = Math.min(limit || DEFAULT_LIMIT, 200)
  let entries = [ ...store.entries ]

  if (project) entries = entries.filter(e => e.project === project)
  if (tags?.length) entries = entries.filter(e =>
    tags.some(tag => e.tags?.some(t => t === tag || t.startsWith(tag + '/')))
  )

  const results = []

  for (const entry of entries) {
    let match = true
    for (const { field, value, op } of filters) {
      const entryValue = entry[field]
      if (entryValue == null || !getType(field).match(entryValue, op || '$eq', value)) {
        match = false
        break
      }
    }
    if (match) {
      results.push(entry)
      if (results.length >= maxResults) break
    }
  }

  const filterFields = [ ...new Set(filters.map(f => f.field)) ]

  if (results.length === 0) {
    ev.ok('no matches')
    return { text: `No entries match filters: ${ filterFields.join(', ') }` }
  }

  let response = `Found ${ results.length } entries`
  if (results.length >= maxResults) response += ` (limit: ${ maxResults })`
  response += ':\n'

  for (const entry of results) {
    const meta = []
    if (entry.tags?.length) meta.push(entry.tags[0])

    for (const field of filterFields) {
      const val = entry[field]
      if (val != null) {
        const display = val instanceof Date ? val.toISOString().slice(0, 10) : val
        meta.push(`${ field }: ${ display }`)
      }
    }

    response += `\n- [[${ entry.name }]]`
    if (meta.length) response += ` (${ meta.join(', ') })`
  }

  ev.ok(`${ results.length } entries`)
  return { text: response }
}
