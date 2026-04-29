import { TOOLS }       from '../../shared/constants.js'
import { store }       from '../modules/store.js'
import { diagnostics } from '../modules/diagnostics.js'
import { createBus }   from '../lib/bus.js'

const bus = createBus('diagnostic')

export const tool = {
  name: TOOLS.DIAGNOSTIC,
  description: `Report entries with issues. Categories:
- links: broken [[wikilinks]] pointing to non-existent entries
- summary: entries missing a summary field (needed for semantic search quality)
- tts: TTS chunking problems (oversized chunks, bad punctuation for synthesis)

Filter by category, project, or tags. Shows up to 20 entries per category.`,
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: ['links', 'summary', 'tts'], description: 'Filter by issue type (omit for all)' },
      project: { type: 'string', description: 'Filter by project' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (prefix match, OR)' },
    },
  },
}

export async function handle ({ category, project, tags } = {}) {
  const filter = category || project || (tags?.length ? tags.join(', ') : null) || 'all'
  const ev = bus.op(filter)
  diagnostics.checkAll()
  let entries = [ ...store.entries ].filter(e => e.issues.size > 0)

  if (project) entries = entries.filter(e => e.project === project)
  if (tags?.length) entries = entries.filter(e =>
    tags.some(tag => e.tags?.some(t => t === tag || t.startsWith(tag + '/')))
  )
  if (category) entries = entries.filter(e => e.issues.has(category))

  if (entries.length === 0) {
    ev.ok('no issues')
    return { text: category ? `No ${ category } issues found.` : 'No issues found.' }
  }

  const categories = new Map()
  for (const entry of entries) {
    for (const [ cat, messages ] of entry.issues) {
      if (category && cat !== category) continue
      if (!categories.has(cat)) categories.set(cat, [])
      categories.get(cat).push({ name: entry.name, messages })
    }
  }

  const MAX_PER_CAT = 20
  let response = ''
  let total = 0

  for (const [ cat, items ] of categories) {
    response += `\n## ${ cat } (${ items.length })\n`
    const shown = items.slice(0, MAX_PER_CAT)
    for (const { name, messages } of shown) {
      response += `\n**[[${ name }]]**\n`
      for (const m of messages) response += `- ${ m }\n`
      total++
    }
    if (items.length > MAX_PER_CAT) {
      response += `\n...and ${ items.length - MAX_PER_CAT } more entries with ${ cat } issues.\n`
      total += items.length - MAX_PER_CAT
    }
  }

  if (categories.has('tts')) {
    response += '\n> TTS fix recommendations:\n' +
                '- Oversized chunks just need shorter sentences - no need to restructure paragraphs.\n' +
                '- Inline dialogue like `she said, "text"` works better with a dash instead of comma: `she said - "text"`.\n' +
                '- Double-Quotes are stripped during synthesis automatically, so can be ignored during analysis.\n'
  }

  ev.ok(`${ total } entries with issues`)
  return { text: `${ total } entries with issues:\n${ response }` }
}
