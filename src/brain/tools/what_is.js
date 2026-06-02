import { store }            from '../modules/store.js'
import { formatResultList } from './_helpers.js'
import { ApiError }         from '../lib/api.js'
import { createBus }        from '../lib/bus.js'

const bus = createBus('what_is')

export async function handle ({ query, tags, project } = {}) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new ApiError(400, 'Missing required: query (non-empty string)')
  }
  const secondary = project ? `in ${ project }` : tags?.length ? `in tags: ${ tags.join(', ') }` : null
  const ev = bus.op(`"${ query }"`, secondary)

  const t0 = Date.now()
  const results = await store.entries.searchByVector(query, 10)
  let filtered = results.filter(r => r.score > 0.6)

  if (project) {
    filtered = filtered.filter(r => r.entity.project === project)
  }

  if (tags && tags.length > 0) {
    filtered = filtered.filter(r =>
        tags.some(tag => r.entity.tags?.some(t => t === tag || t.startsWith(tag + '/'))),
    )
  }

  const queryLower = query.toLowerCase()
  for (const r of filtered) {
    if (r.entity.name.toLowerCase().includes(queryLower) && r.score < 0.8) r.score = 0.8
  }
  filtered.sort((a, b) => b.score - a.score)

  filtered = filtered.slice(0, 5)

  if (filtered.length === 0) {
    ev.ok('no results')
    return { text: `No entries found for "${ query }". Try different wording or use the grep tool for literal matches.` }
  }

  const ms = Date.now() - t0
  const body = formatResultList(filtered, { showScore: true, hideProject: !!project })
  ev.ok(`${ filtered.length } in ${ ms }ms`, ...body.split('\n'))

  return { text: `Top ${ filtered.length } for "${ query }":\n\n${ body }\n\nUse \`get\` with an entry name to read full content.` }
}
