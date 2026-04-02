import { obsidian }                        from '../modules/obsidian.js'
import { stripBrackets }                   from '../lib/utils.js'
import { ApiError }                        from '../lib/api.js'
import { entryNotFoundMessage, findEntry, checkStale, markSeen } from './_helpers.js'
import { createBus }                       from '../lib/bus.js'

const bus = createBus('insert')

function truncate (str, len = 40) {
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}

/**
 * Insert text into entry content.
 * - marker + position:before/after → insert at marker
 * - no marker + position:end (default) → append
 * - no marker + position:start → prepend
 * @param {{ name: string, text: string, marker?: string, position?: 'before'|'after'|'start'|'end' }} body
 */
export async function handleInsert ({ name, text, marker, position }) {
  if (!name || text === undefined) {
    throw new ApiError(400, 'Missing required fields: name, text')
  }

  const cleanName = stripBrackets(name)
  const pos = position || 'end'
  const ev = bus.op(cleanName, marker ? `${pos} marker` : pos)
  const entry = findEntry(cleanName)

  if (!entry) {
    ev.warn('not found')
    return { text: await entryNotFoundMessage(cleanName) }
  }

  const stale = checkStale(entry)
  if (stale) { ev.warn('stale'); return { text: stale } }

  let newContent

  if (marker) {
    if (pos !== 'before' && pos !== 'after') {
      throw new ApiError(400, 'With marker, position must be "before" or "after"')
    }

    const index = entry.content.indexOf(marker)
    if (index === -1) {
      throw new ApiError(404, `Marker not found: "${ truncate(marker) }"`)
    }

    const secondIndex = entry.content.indexOf(marker, index + 1)
    if (secondIndex !== -1) {
      throw new ApiError(400, `Marker found multiple times - use more specific string: "${ truncate(marker) }"`)
    }

    if (pos === 'before') {
      newContent = entry.content.slice(0, index) + text + entry.content.slice(index)
    } else {
      const insertAt = index + marker.length
      newContent = entry.content.slice(0, insertAt) + text + entry.content.slice(insertAt)
    }
  } else if (pos === 'start') {
    newContent = text + '\n\n' + entry.content
  } else {
    newContent = entry.content + '\n\n' + text
  }

  await obsidian.updateFile(entry, newContent)
  markSeen(findEntry(entry.name))

  const label = marker ? `${ pos } "${ truncate(marker) }"` : pos === 'start' ? 'at start' : 'at end'
  ev.ok(`inserted ${ label }`)
  return { text: `Inserted ${ label } of "${ entry.name }"` }
}
