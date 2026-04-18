import { obsidian }                        from '../modules/obsidian.js'
import { ApiError }                        from '../lib/api.js'
import { entryNotFoundMessage, findEntry, checkStale, markSeen, typeWarnings } from './_helpers.js'
import { createBus }                       from '../lib/bus.js'

const bus = createBus('update')

const READONLY_FIELDS = new Set([ 'name', 'source_file', 'content_hash', 'created' ])
const ARRAY_FIELDS = new Set([ 'tags', 'aliases', 'related' ])

/**
 * Update entry fields.
 * @param {{ name: string, fields: Array<{ property: string, value: any }> }} body
 * @returns {Promise<{ text: string }>}
 */
export async function handleUpdate ({ name, fields }) {
  if (!name) {
    throw new ApiError(400, 'Missing required field: name')
  }

  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    throw new ApiError(400, 'Missing required field: fields (array of {property, value})')
  }

  for (const field of fields) {
    if (!field.property || field.value === undefined) {
      throw new ApiError(400, 'Each field must have property and value')
    }
    if (READONLY_FIELDS.has(field.property)) {
      if (field.property === 'name') {
        throw new ApiError(400, 'Use the "rename" tool to change entry name')
      }
      throw new ApiError(400, `Field "${ field.property }" is read-only`)
    }
    if (ARRAY_FIELDS.has(field.property) && !Array.isArray(field.value)) {
      throw new ApiError(400, `Field "${ field.property }" must be an array`)
    }
  }

  const fieldNames = fields.map(f => f.property).join(', ')
  const ev = bus.op(name, fieldNames)
  const entry = findEntry(name)

  if (!entry) {
    ev.warn('not found')
    return { text: await entryNotFoundMessage(name) }
  }

  const stale = checkStale(entry)
  if (stale) { ev.warn('stale'); return { text: stale } }

  const updatedProps = {}
  let newContent = null

  for (const field of fields) {
    if (field.property === 'content') {
      newContent = field.value
    } else {
      updatedProps[field.property] = field.value
    }
  }

  const content = newContent !== null ? newContent : entry.content
  const warnings = typeWarnings(updatedProps)

  await obsidian.updateFile(entry, content, updatedProps)
  markSeen(findEntry(name))
  ev.ok(`updated (${ fieldNames })`)
  let text = `Updated "${ name }" (${ fieldNames })`
  if (warnings.length) text += `\n\nWarnings:\n- ${ warnings.join('\n- ') }`
  return { text }
}
