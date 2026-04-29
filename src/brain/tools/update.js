import { TOOLS }                            from '../../shared/constants.js'
import { obsidian }                         from '../modules/obsidian.js'
import { ApiError }                         from '../lib/api.js'
import { entryNotFoundMessage, findEntry, checkStale, markSeen, typeWarnings } from './_helpers.js'
import { createBus }                        from '../lib/bus.js'

const bus = createBus('update')

const READONLY_FIELDS = new Set([ 'name', 'source_file', 'content_hash', 'created' ])
const ARRAY_FIELDS = new Set([ 'tags', 'aliases', 'related' ])

export const tool = {
  name: TOOLS.UPDATE,
  description: `Update entry fields.

Any field can be updated except read-only ones (name, source_file, content_hash, created, modified — both dates are auto-managed).
Array fields (tags, aliases, related) must be arrays.

Usage:
- Pass array of {property, value} objects
- Arrays replace entirely, not merge
- Use "get" first to see current values before updating

Example: fields: [{property: "project", value: "Work"}, {property: "tags", value: ["work/task"]}, {property: "state", value: "draft"}]`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            property: { type: 'string', description: 'Field name' },
            value: { description: 'New value (string or array)' },
          },
          required: [ 'property', 'value' ],
        },
        description: 'Array of {property, value} objects',
      },
    },
    required: [ 'name', 'fields' ],
  },
}

export const injectFields = 'write'

export async function handle ({ name, fields }) {
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
