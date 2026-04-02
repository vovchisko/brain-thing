import { store }       from '../modules/store.js'
import { formatEntry, markSeen } from './_helpers.js'
import { createBus }   from '../lib/bus.js'

const bus = createBus('what_is')

/**
 * Format entries as compact list with tags, score, and summary.
 */
function formatEntryList (entries, options = {}) {
  let response = ''
  for (const entry of entries) {
    response += `\n- [[${ entry.name }]]`

    const parts = []
    if (entry.tags && entry.tags.length > 0) {
      parts.push(entry.tags.join(', '))
    }
    if (options.showScore && entry.score !== undefined) {
      parts.push(`${ (entry.score * 100).toFixed(0) }%`)
    }

    if (parts.length > 0) response += ` (${ parts.join(' - ') })`

    if (options.showSummary && entry.summary) {
      response += `\n  ${ entry.summary }`
    }
  }

  return response
}

/**
 * Semantic search by meaning.
 * @param {{ query: string, tags?: string[], project?: string }} body
 * @returns {Promise<{ text: string }>}
 */
export async function handleWhatIs ({ query, tags, project }) {
  const secondary = project ? `in ${ project }` : tags?.length ? `in tags: ${ tags.join(', ') }` : null
  const ev = bus.op(`"${ query }"`, secondary)

  const exact = store.entries.get(query)
  if (exact) {
    ev.ok(`exact match: ${ exact.name }`)
    markSeen(exact)
    let response = formatEntry(exact)
    const backlinks = store.findBacklinks(exact.name)
    if (backlinks && backlinks.length > 0) {
      response += '\n\nBacklinks: ' + backlinks.map(b => `[[${ b.name }]]`).join(', ')
    }
    return { text: response }
  }

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

  filtered = filtered.slice(0, 5)

  if (filtered.length === 0) {
    ev.ok('no results')
    return { text: `No entries found for "${ query }".` }
  }

  const top = filtered[0]

  // Name contains query — treat as high confidence
  const queryLower = query.toLowerCase()
  const nameHit = filtered.find(r => r.entity.name.toLowerCase().includes(queryLower))
  if (nameHit && nameHit.score < 0.8) {
    nameHit.score = 0.8
    filtered.sort((a, b) => b.score - a.score)
  }

  if (top.score < 0.8) {
    ev.ok(
      `${ filtered.length } similar entries:`,
      ...filtered.map(r => `- ${ r.entity.name } (${ (r.score * 100).toFixed(0) }%)`),
    )
    let response = `No meaningful match for "${ query }". Similar entries:\n`
    for (const r of filtered) {
      response += `\n- [[${ r.entity.name }]] (${ (r.score * 100).toFixed(0) }%)`
    }
    return { text: response }
  }

  // High confidence match - show full entry as frontmatter + content
  markSeen(top.entity)
  let response = formatEntry(top.entity)

  const backlinks = store.findBacklinks(top.entity.name)
  if (backlinks && backlinks.length > 0) {
    response += '\n\nBacklinks: ' + backlinks.map(b => `[[${ b.name }]]`).join(', ')
  }

  if (filtered.length > 1) {
    const related = filtered.slice(1).map(r => ({
      name: r.entity.name,
      tags: r.entity.tags,
      score: r.score,
      summary: r.entity.summary,
    }))
    response += '\n' + formatEntryList(related, { showScore: true, showSummary: true })
  }

  const ms = Date.now() - t0
  ev.ok(
    `found in ${ ms }ms:`,
    ...filtered.map(r => `${ r.entity.name } (${ (r.score * 100).toFixed(0) }%)`),
  )
  return { text: response }
}
