import { store }     from '../modules/store.js'
import { createBus } from '../lib/bus.js'

const bus = createBus('tags_list')

/**
 * List tags with counts. If tag provided — show subtags and entries for that prefix.
 * @param {{ tag?: string }} body
 * @returns {Promise<{ text: string }>}
 */
export async function handleTagsList ({ tag } = {}) {
  bus.info(tag || 'all tags')
  const counts = new Map() // tag → count

  for (const entry of store.entries) {
    for (const t of (entry.tags || [])) {
      counts.set(t, (counts.get(t) || 0) + 1)
    }
  }

  // No filter → all tags with counts
  if (!tag) {
    const sorted = [ ...counts.entries() ].sort((a, b) => a[0].localeCompare(b[0]))
    let response = `All tags (${ sorted.length }):\n`
    for (const [ t, count ] of sorted) {
      response += `\n- ${ t } (${ count })`
    }
    return { text: response }
  }

  // With tag → subtags + entries at this level
  const prefix = tag.endsWith('/') ? tag : tag + '/'
  const subtags = new Map()
  const exact = []
  let totalUnder = 0

  for (const entry of store.entries) {
    for (const t of (entry.tags || [])) {
      if (t === tag) exact.push(entry)
      if (t.startsWith(prefix)) {
        totalUnder++
        const nextPart = t.slice(prefix.length).split('/')[0]
        const subtag = prefix + nextPart
        subtags.set(subtag, (subtags.get(subtag) || 0) + 1)
      }
    }
  }

  const total = exact.length + totalUnder
  let response = `Tag: ${ tag } — ${ total } entries total (${ exact.length } tagged exactly "${ tag }", ${ totalUnder } in subtags)\n`

  if (subtags.size > 0) {
    response += '\nSubtags:'
    const sorted = [ ...subtags.entries() ].sort((a, b) => a[0].localeCompare(b[0]))
    for (const [ subtag, count ] of sorted) {
      response += `\n- ${ subtag } (${ count })`
    }
  }

  if (exact.length > 0) {
    response += `\n\nEntries tagged exactly "${ tag }" (${ exact.length }):`
    for (const entry of exact) {
      response += `\n- [[${ entry.name }]]`
    }
  } else if (subtags.size === 0) {
    response += '\nNo entries or subtags found.'
  }

  return { text: response }
}
