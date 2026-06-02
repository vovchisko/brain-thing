import { obsidian }                                                              from '../modules/obsidian.js'
import { ApiError }                                                              from '../lib/api.js'
import { entryNotFoundMessage, findEntry, checkStale, markSeen, typeWarnings }  from './_helpers.js'
import { createBus }                                                             from '../lib/bus.js'

const bus = createBus('edit')

function formatError (e) {
  const at = e.index != null ? `op[${ e.index }]` : 'attributes'
  const type = e.type ? ` (${ e.type })` : ''
  return `${ at }${ type }: ${ e.reason }`
}

function summarise (operations, props) {
  const parts = []
  if (operations?.length) parts.push(`${ operations.length } op${ operations.length === 1 ? '' : 's' }`)
  const attrCount = Object.keys(props).length
  if (attrCount) parts.push(`${ attrCount } attr${ attrCount === 1 ? '' : 's' }`)
  return parts.join(', ')
}

export async function handle ({ name, operations, attributes } = {}) {
  if (!name) throw new ApiError(400, 'Missing required: name')

  const hasOps = Array.isArray(operations) && operations.length > 0
  const hasAttrs = attributes && typeof attributes === 'object' && !Array.isArray(attributes) && Object.keys(attributes).length > 0
  if (!hasOps && !hasAttrs) throw new ApiError(400, 'Provide "operations" and/or "attributes"')

  const ev = bus.op(name, summarise(operations, attributes || {}))
  const entry = findEntry(name)

  if (!entry) {
    ev.warn('not found')
    return { text: await entryNotFoundMessage(name) }
  }

  const stale = checkStale(entry)
  if (stale) { ev.warn('stale'); return { text: stale } }

  const result = entry.applyEdits({ operations, attributes })

  if (result.errors) {
    ev.warn(`${ result.errors.length } error(s)`)
    const lines = result.errors.map(formatError)
    throw new ApiError(400, `Edit failed (no changes):\n- ${ lines.join('\n- ') }`)
  }

  await obsidian.updateFile(entry, result.content, result.props)
  markSeen(findEntry(name))

  const warnings = typeWarnings(result.props)
  ev.ok(summarise(operations, result.props))

  let text = `Edited "${ name }" (${ summarise(operations, result.props) || 'no-op' })`
  if (warnings.length) text += `\n\nWarnings:\n- ${ warnings.join('\n- ') }`
  return { text }
}
