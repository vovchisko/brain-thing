import { TOOLS }                                                  from '../../shared/constants.js'
import { obsidian }                                               from '../modules/obsidian.js'
import { stripBrackets }                                          from '../lib/utils.js'
import { ApiError }                                               from '../lib/api.js'
import { entryNotFoundMessage, findEntry, checkStale, markSeen }  from './_helpers.js'
import { createBus }                                              from '../lib/bus.js'

const bus = createBus('insert')

export const tool = {
  name: TOOLS.INSERT,
  description: `Insert text into entry content. Two modes:

Positional (no marker): inserts at "start" or "end" (default) of content.
Marker-based (with marker): inserts "before" or "after" a unique string in the content.

position + marker combinations:
- "end" (default, no marker) — append to content
- "start" (no marker) — prepend to content
- "before" + marker — insert before the marker string
- "after" + marker — insert after the marker string

No whitespace is added automatically — include any needed "\\n" in your text yourself. Examples:
- "\\n\\nNew paragraph." — append as a new paragraph
- " and more." — continue the last line inline
- "Header line\\n\\n" (prepend) — add header above existing content

Marker must appear exactly once in content — use "get" first to find unique text.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
      text: { type: 'string', description: 'Text to insert' },
      marker: { type: 'string', description: 'Unique string to insert near (optional — omit to append/prepend)' },
      position: {
        type: 'string',
        enum: [ 'before', 'after', 'start', 'end' ],
        description: 'Where to insert (default: "end")',
      },
    },
    required: [ 'name', 'text' ],
  },
}

function truncate (str, len = 40) {
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}

export async function handle ({ name, text, marker, position }) {
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
    newContent = text + entry.content
  } else {
    newContent = entry.content + text
  }

  await obsidian.updateFile(entry, newContent)
  markSeen(findEntry(entry.name))

  const label = marker ? `${ pos } "${ truncate(marker) }"` : pos === 'start' ? 'at start' : 'at end'
  ev.ok(`inserted ${ label }`)
  return { text: `Inserted ${ label } of "${ entry.name }"` }
}
