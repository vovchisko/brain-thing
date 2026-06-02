import { ApiError }                                from '../lib/api.js'
import { findEntry, gatherLinks, markSeen, renderDoc, wordsOf } from './_helpers.js'
import { createBus }                               from '../lib/bus.js'

const bus = createBus('long_read')

const MODE = { read: 'full', focus: 'focus', estimate: 'estimate' }

function resolve (names) {
  const found = []
  const missing = []
  const seen = new Set()
  for (const raw of names) {
    const name = String(raw).trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const entry = findEntry(name)
    if (entry) found.push(entry)
    else missing.push(name)
  }
  return { found, missing }
}

function totalWords (entries) {
  let n = 0
  for (const e of entries) n += wordsOf(e)
  return n
}

function missingTrailer (missing) {
  return missing.length ? `\n\nNot found (${ missing.length }): ${ missing.join(', ') }` : ''
}

export async function handle ({ operation, documents } = {}) {
  const mode = MODE[operation]
  if (!mode) {
    throw new ApiError(400, 'operation must be "read", "focus" or "estimate"')
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new ApiError(400, 'documents must be a non-empty array of names')
  }

  const { found, missing } = resolve(documents)
  const ev = bus.op(`${ operation } ${ found.length }/${ documents.length }`)

  if (found.length === 0) {
    ev.warn('all missing')
    return { text: `No entries found for: ${ missing.join(', ') }. Use "what_is" to search by meaning.` }
  }

  ev.ok(`${ found.length } entries, ${ totalWords(found) } words`)

  // long_read = get repeated. Docs separate by their own `=== [[name]] ===` markers.
  if (mode === 'estimate') {
    const head = `${ totalWords(found) } words across ${ found.length } doc${ found.length === 1 ? '' : 's' }`
    const blocks = found.map(e => renderDoc(e, 'estimate')).join('\n\n')
    return { text: `${ head }\n\n${ blocks }${ missingTrailer(missing) }` }
  }

  if (mode === 'full') for (const entry of found) markSeen(entry)
  const blocks = found.map(e => renderDoc(e, mode, mode === 'full' ? { links: gatherLinks(e) } : {})).join('\n\n')
  return { text: `${ blocks }${ missingTrailer(missing) }` }
}
