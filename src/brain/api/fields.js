import { store }      from '../modules/store.js'
import { config }     from '../config.js'
import { createBus }  from '../lib/bus.js'

const bus = createBus('fields')

const SKIP = new Set([ 'name', 'content', 'source_file', 'content_hash', 'aliases' ])

/**
 * Introspect frontmatter fields across entries.
 * @param {{ tags?: string[], project?: string }} body
 */
export async function handleFields ({ tags, project } = {}) {
  bus.info(project || (tags?.length ? tags.join(', ') : null) || 'all')
  let entries = [ ...store.entries ]

  if (project) entries = entries.filter(e => e.project === project)
  if (tags?.length) entries = entries.filter(e =>
    tags.some(tag => e.tags?.some(t => t === tag || t.startsWith(tag + '/')))
  )

  if (entries.length === 0) {
    return { text: 'No entries match the given filters.' }
  }

  // Collect field stats
  const stats = new Map() // field → { count, values: Map<value, count> }

  for (const entry of entries) {
    for (const [ key, value ] of Object.entries(entry)) {
      if (SKIP.has(key)) continue
      if (value == null) continue
      if (Array.isArray(value) && value.length === 0) continue

      let stat = stats.get(key)
      if (!stat) {
        stat = { count: 0, values: new Map() }
        stats.set(key, stat)
      }
      stat.count++

      // Collect values for stats
      const vals = Array.isArray(value) ? value : [ value ]
      for (const v of vals) {
        const sv = v instanceof Date ? v.toISOString().slice(0, 10) : String(v)
        stat.values.set(sv, (stat.values.get(sv) || 0) + 1)
      }
    }
  }

  const typeDefs = config.fields || {}
  let response = `Fields across ${ entries.length } entries`
  if (tags?.length) response += ` [tags: ${ tags.join(', ') }]`
  if (project) response += ` [project: ${ project }]`
  response += ':\n'

  // Sort: system fields first, then by count desc
  const sorted = [ ...stats.entries() ].sort((a, b) => b[1].count - a[1].count)

  for (const [ field, stat ] of sorted) {
    const def = typeDefs[field]
    const type = def ? def.type : 'string'
    const pct = Math.round(stat.count / entries.length * 100)

    response += `\n- **${ field }** (${ type }) — ${ stat.count } entries (${ pct }%)`
    if (def?.desc) response += `\n  ${ def.desc }`

    if (def?.values) {
      response += `\n  known: ${ def.values.join(', ') }`
    }

    // Show value summary based on type
    if (type === 'date' && stat.values.size > 0) {
      const dates = [ ...stat.values.keys() ].sort()
      response += `\n  range: ${ dates[0] } .. ${ dates[dates.length - 1] }`
    } else if (type === 'number' && stat.values.size > 0) {
      const nums = [ ...stat.values.keys() ].map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b)
      if (nums.length) response += `\n  range: ${ nums[0] } .. ${ nums[nums.length - 1] }`
    } else if (stat.values.size <= 20) {
      const top = [ ...stat.values.entries() ]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ v, c ]) => c > 1 ? `${ v } (${ c })` : v)
      response += `\n  values: ${ top.join(', ') }`
    } else {
      response += `\n  ${ stat.values.size } unique values`
    }
  }

  return { text: response }
}
