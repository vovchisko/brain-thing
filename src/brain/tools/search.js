import { store }            from '../modules/store.js'
import { cfg }              from '../config.js'
import { ApiError }         from '../lib/api.js'
import { AttributeType }    from '../lib/attribute-types.js'
import { formatResultList } from './_helpers.js'
import { createBus }        from '../lib/bus.js'

const bus = createBus('search')

const DEFAULT_LIMIT = 50

const fallback = new AttributeType()

const OPS_BY_TYPE = {
  string: new Set(['$eq']),
  date: new Set(['$eq', '$gt', '$gte', '$lt', '$lte']),
  number: new Set(['$eq', '$gt', '$gte', '$lt', '$lte']),
  list: new Set(['$eq', '$any', '$all']),
}

function getType (attribute) {
  return cfg.state.vault.attributes?.[attribute] || fallback
}

function attributeExistsInAnyEntry (attribute) {
  for (const e of store.entries) if (attribute in e) return true
  return false
}

export async function handle ({ filters, tags, project, limit } = {}) {
  const parts = []
  if (project) parts.push(`project: ${ project }`)
  if (tags?.length) parts.push(`tags: ${ tags.join(', ') }`)
  const ev = bus.op(`${ (filters || []).length } filters`, parts.length ? parts.join(', ') : null)

  if (!Array.isArray(filters) || filters.length === 0) {
    throw new ApiError(400, 'Missing required: filters (array of {attribute, value, op?})')
  }

  for (const f of filters) {
    if (!f.attribute || f.value === undefined) {
      throw new ApiError(400, `Invalid filter: each must have "attribute" and "value"`)
    }
  }

  for (const f of filters) {
    const op = f.op || '$eq'
    const type = getType(f.attribute)
    const configured = !!cfg.state.vault.attributes?.[f.attribute]
    const supportedOps = OPS_BY_TYPE[type.type] || OPS_BY_TYPE.string

    if (!configured && !attributeExistsInAnyEntry(f.attribute)) {
      ev.warn('unknown attribute')
      return { text: `Attribute "${ f.attribute }" not found in any entry. Use the attributes tool to see available attributes.` }
    }
    if (!supportedOps.has(op)) {
      ev.warn('bad op')
      const ops = [ ...supportedOps ].join(', ')
      const hint = configured
        ? `Attribute "${ f.attribute }" is type "${ type.type }"; operator "${ op }" not supported. Allowed: ${ ops }.`
        : `Attribute "${ f.attribute }" has no configured type (treated as string); operator "${ op }" not supported. Allowed: ${ ops }. Configure the attribute type in Settings → Attributes to enable richer operators.`
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
    for (const { attribute, value, op } of filters) {
      const entryValue = entry[attribute]
      if (entryValue == null || !getType(attribute).match(entryValue, op || '$eq', value)) {
        match = false
        break
      }
    }
    if (match) {
      results.push(entry)
      if (results.length >= maxResults) break
    }
  }

  if (results.length === 0) {
    ev.ok('no matches')
    return { text: `No entries match.` }
  }

  let header = `Found ${ results.length } entries`
  if (results.length >= maxResults) header += ` (limit: ${ maxResults })`

  const projectFiltered = !!project || filters.some(f => f.attribute === 'project')
  const body = formatResultList(results, { hideProject: projectFiltered })
  ev.ok(`${ results.length } entries`, ...body.split('\n'))
  return { text: `${ header }:\n\n${ body }\n\nUse \`get\` to read full content.` }
}
