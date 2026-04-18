import { store }            from '../modules/store.js'
import { cfg }              from '../config.js'
import { ApiError }         from '../lib/api.js'
import { FieldType }        from '../lib/field-types.js'
import { formatResultList } from './_helpers.js'
import { createBus }        from '../lib/bus.js'

const bus = createBus('search')

const DEFAULT_LIMIT = 50

const fallback = new FieldType()

const OPS_BY_TYPE = {
  string: new Set(['$eq']),
  date: new Set(['$eq', '$gt', '$gte', '$lt', '$lte']),
  number: new Set(['$eq', '$gt', '$gte', '$lt', '$lte']),
  list: new Set(['$eq', '$any', '$all']),
}

function getType (field) {
  return cfg.state.vault.fields?.[field] || fallback
}

function fieldExistsInAnyEntry (field) {
  for (const e of store.entries) if (field in e) return true
  return false
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

  // Pre-validate: type + op compatibility, field existence
  for (const f of filters) {
    const op = f.op || '$eq'
    const type = getType(f.field)
    const configured = !!cfg.state.vault.fields?.[f.field]
    const supportedOps = OPS_BY_TYPE[type.type] || OPS_BY_TYPE.string

    if (!configured && !fieldExistsInAnyEntry(f.field)) {
      ev.warn('unknown field')
      return { text: `Field "${ f.field }" not found in any entry. Use the fields tool to see available fields.` }
    }
    if (!supportedOps.has(op)) {
      ev.warn('bad op')
      const ops = [ ...supportedOps ].join(', ')
      const hint = configured
        ? `Field "${ f.field }" is type "${ type.type }"; operator "${ op }" not supported. Allowed: ${ ops }.`
        : `Field "${ f.field }" has no configured type (treated as string); operator "${ op }" not supported. Allowed: ${ ops }. Configure the field type in Settings → Fields to enable richer operators.`
      return { text: hint }
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

  let header = `Found ${ results.length } entries`
  if (results.length >= maxResults) header += ` (limit: ${ maxResults })`

  const projectFiltered = !!project || filters.some(f => f.field === 'project')
  const body = formatResultList(results, { hideProject: projectFiltered })
  ev.ok(`${ results.length } entries`, ...body.split('\n'))
  return { text: `${ header }:\n\n${ body }\n\nUse \`get\` to read full content.` }
}
