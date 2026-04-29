import { TOOLS }      from '../../shared/constants.js'
import { store }      from '../modules/store.js'
import { ApiError }   from '../lib/api.js'
import { createBus }  from '../lib/bus.js'

const bus = createBus('grep')

export const tool = {
  name: TOOLS.GREP,
  description: `Literal text search - finds exact matches across all entries.

Unlike what_is (semantic), this searches for exact text in title, content, and summary.

Results grouped:
- Title matches first
- Content matches sorted by occurrence count

Case-insensitive. Use tags/project to narrow results.`,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to find' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (prefix match, OR)' },
      project: { type: 'string', description: 'Filter by project' },
    },
    required: ['text'],
  },
}

function countMatches (text, search) {
  if (!text) return 0
  const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return (text.match(regex) || []).length
}

export async function handle ({ text, tags, project }) {
  const ev = bus.op(`"${ text }"`)
  if (!text) {
    throw new ApiError(400, 'Missing required field: text')
  }

  const searchText = text.toLowerCase()

  let matches = store.entries.filter(entry => {
    if (entry.name.toLowerCase().includes(searchText)) return true
    if (entry.content?.toLowerCase().includes(searchText)) return true
    if (entry.summary?.toLowerCase().includes(searchText)) return true
    return false
  })

  if (project) {
    matches = matches.filter(e => e.project === project)
  }

  if (tags && tags.length > 0) {
    matches = matches.filter(e =>
        tags.some(tag => e.tags?.some(t => t === tag || t.startsWith(tag + '/'))),
    )
  }

  if (matches.length === 0) {
    ev.ok('no matches')
    return { text: `No entries contain "${ text }"` }
  }

  const titleMatches = []
  const contentMatches = []

  for (const entry of matches) {
    const inTitle = entry.name.toLowerCase().includes(searchText)
    const contentCount = countMatches(entry.content, text) + countMatches(entry.summary, text)

    if (inTitle) {
      titleMatches.push({ entry, count: contentCount })
    } else {
      contentMatches.push({ entry, count: contentCount })
    }
  }

  contentMatches.sort((a, b) => b.count - a.count)

  let response = `Found "${ text }" in ${ matches.length } entries:`

  if (titleMatches.length > 0) {
    response += `\n\nIn title:`
    for (const { entry } of titleMatches) {
      response += `\n- [[${ entry.name }]]`
    }
  }

  if (contentMatches.length > 0) {
    response += `\n\nIn content:`
    for (const { entry, count } of contentMatches) {
      response += `\n- [[${ entry.name }]]` + (count > 1 ? ` (${ count }x)` : '')
    }
  }

  ev.ok(`${ titleMatches.length + contentMatches.length } entries`)
  return { text: response }
}
