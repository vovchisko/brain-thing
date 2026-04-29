import { TOOLS }                                          from '../../shared/constants.js'
import { store }                                          from '../modules/store.js'
import { extractWikilinks, isEmptyEntry, stripBrackets }  from '../lib/utils.js'
import { entryNotFoundMessage, entryProps, findEntry, formatEntry, formatEntryInline, markSeen } from './_helpers.js'
import { createBus }                                      from '../lib/bus.js'

const bus = createBus('get')

export const tool = {
  name: TOOLS.GET,
  description: `Get entry by exact name.

Returns entry with metadata fields (name, tags, summary, etc.) and markdown content.
Also shows backlinks (entries referencing this one) and missing/empty outgoing links if any.

Usage:
- Use exact entry name (case-insensitive)
- If entry not found, returns semantic suggestions
- Use [[wikilinks]] format when referencing entries in content`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
    },
    required: [ 'name' ],
  },
}

export async function handle ({ name }) {
  const cleanName = stripBrackets(name)
  const ev = bus.op(cleanName)
  const match = findEntry(cleanName)

  if (!match) {
    ev.warn('not found')
    return { text: await entryNotFoundMessage(cleanName) }
  }
  ev.ok(entryProps(match))
  markSeen(match)

  let response = formatEntry(match)

  const backlinks = store.findBacklinks(match.name)
  if (backlinks && backlinks.length > 0) {
    response += `\n\nBacklinks (${ backlinks.length }):\n`
    response += backlinks.map(b => `- ${ formatEntryInline(b) }`).join('\n')
  }

  // Outgoing broken/empty links
  const outgoing = extractWikilinks(match.content)
  const unique = [ ...new Set(outgoing) ]
  const missingLinks = []
  const emptyLinks = []

  for (const linkName of unique) {
    if (linkName === match.name) continue
    const target = store.entries.get(linkName)
    if (!target) {
      missingLinks.push(linkName)
    } else if (isEmptyEntry(target)) {
      emptyLinks.push(target)
    }
  }

  if (missingLinks.length > 0) {
    response += '\n\nMissing links: ' + missingLinks.map(n => `[[${ n }]]`).join(', ')
  }

  if (emptyLinks.length > 0) {
    response += '\n\nEmpty links: ' + emptyLinks.map(e => {
      const tags = e.tags?.length ? ` [tags: ${ e.tags.join(', ') }]` : ''
      return `[[${ e.name }]]${ tags }`
    }).join(', ')
  }

  return { text: response }
}
