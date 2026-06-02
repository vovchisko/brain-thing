import { stripBrackets }                                  from '../lib/utils.js'
import { entryNotFoundMessage, entryProps, findEntry, gatherLinks, markSeen, renderDoc } from './_helpers.js'
import { createBus }                                      from '../lib/bus.js'

const bus = createBus('get')

// read → full doc + links; focus → body only; estimate → frontmatter + word count.
const MODE = { read: 'full', focus: 'focus', estimate: 'estimate' }

export async function handle ({ name, operation = 'read' } = {}) {
  const cleanName = stripBrackets(name)
  const ev = bus.op(cleanName, operation === 'read' ? null : operation)
  const match = findEntry(cleanName)

  if (!match) {
    ev.warn('not found')
    return { text: await entryNotFoundMessage(cleanName) }
  }
  ev.ok(entryProps(match))
  markSeen(match)

  const mode = MODE[operation] || 'full'
  const links = mode === 'full' ? gatherLinks(match) : undefined
  return { text: renderDoc(match, mode, { links }) }
}
