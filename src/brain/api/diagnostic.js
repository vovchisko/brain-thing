import { store }       from '../modules/store.js'
import { config }      from '../config.js'
import { diagnostics } from '../modules/diagnostics.js'
import { findScope }   from '../modules/organize.js'
import { createBus }   from '../lib/bus.js'

const bus = createBus('diagnostic')

/**
 * Report all entries with issues, grouped by category.
 * @param {{ category?: string, scope?: string, tag?: string }} body
 */
export async function handleDiagnostic ({ category, scope, tags } = {}) {
  const filter = category || scope || (tags?.length ? tags.join(', ') : null) || 'all'
  const ev = bus.op(filter)
  diagnostics.checkAll()
  let entries = [ ...store.entries ].filter(e => e.issues.size > 0)

  if (scope) entries = entries.filter(e => findScope(e)?.name === scope)
  if (tags?.length) entries = entries.filter(e =>
    tags.some(tag => e.tags?.some(t => t === tag || t.startsWith(tag + '/')))
  )
  if (category) entries = entries.filter(e => e.issues.has(category))

  if (entries.length === 0) {
    ev.ok('no issues')
    return { text: category ? `No ${ category } issues found.` : 'No issues found.' }
  }

  // Group by category
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
    if (config.normalizeTypography) {
      response += '> Note: Typography normalization is ON — all dashes are normalized to `-` across all docs.\n'
    }
  }

  ev.ok(`${ total } entries with issues`)
  return { text: `${ total } entries with issues:\n${ response }` }
}
