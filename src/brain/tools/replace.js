import { TOOLS }                                                  from '../../shared/constants.js'
import { obsidian }                                               from '../modules/obsidian.js'
import { ApiError }                                               from '../lib/api.js'
import { entryNotFoundMessage, findEntry, checkStale, markSeen }  from './_helpers.js'
import { createBus }                                              from '../lib/bus.js'

const bus = createBus('replace')

export const tool = {
  name: TOOLS.REPLACE,
  description: `Find and replace text in entry content. Atomic — all or nothing.

Single mode: pass old_string + new_string (+ optional replace_all).
Batch mode: pass pairs array [{old_string, new_string, replace_all?}, ...].
Use one or the other, never both.

- old_string must exist in content; fails if not found
- If old_string appears multiple times and replace_all is false, operation fails (ambiguous match)
- In batch mode, all pairs are validated before any changes are applied
- Use "get" first to see current content`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
      old_string: { type: 'string', description: 'Text to replace' },
      new_string: { type: 'string', description: 'Replacement text' },
      replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
      pairs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            old_string: { type: 'string' },
            new_string: { type: 'string' },
            replace_all: { type: 'boolean' },
          },
          required: [ 'old_string', 'new_string' ],
        },
        description: 'Multiple replacements: [{old_string, new_string, replace_all?}, ...]',
      },
    },
    required: [ 'name' ],
  },
}

function truncate (str, len = 40) {
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}

function countOccurrences (content, str) {
  return content.split(str).length - 1
}

export async function handle ({ name, old_string, new_string, replace_all, pairs }) {
  if (!name) {
    throw new ApiError(400, 'Missing required field: name')
  }

  let operations = []
  if (pairs && Array.isArray(pairs)) {
    operations = pairs
  } else if (old_string !== undefined && new_string !== undefined) {
    operations = [ { old_string, new_string, replace_all } ]
  } else {
    throw new ApiError(400, 'Provide old_string/new_string or pairs array')
  }

  if (operations.length === 0) {
    throw new ApiError(400, 'No replacement operations provided')
  }

  const ev = bus.op(name, `${ operations.length } replacement(s)`)
  const entry = findEntry(name)

  if (!entry) {
    ev.warn('not found')
    return { text: await entryNotFoundMessage(name) }
  }

  const stale = checkStale(entry)
  if (stale) { ev.warn('stale'); return { text: stale } }

  const errors = []
  const validated = []

  for (const op of operations) {
    if (!op.old_string || op.new_string === undefined) {
      errors.push(`Invalid pair: missing old_string or new_string`)
      continue
    }

    const count = countOccurrences(entry.content, op.old_string)

    if (count === 0) {
      errors.push(`Not found: "${ truncate(op.old_string) }"`)
    } else if (count > 1 && !op.replace_all) {
      errors.push(`"${ truncate(op.old_string) }" found ${ count }x - use replace_all:true or be more specific`)
    } else {
      validated.push({ ...op, count })
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, `Replace failed (no changes made):\n- ${ errors.join('\n- ') }`)
  }

  let content = entry.content
  const results = []

  for (const op of validated) {
    content = op.replace_all
        ? content.replaceAll(op.old_string, op.new_string)
        : content.replace(op.old_string, op.new_string)

    const countStr = op.count > 1 ? ` (${ op.count }x)` : ''
    results.push(`"${ op.old_string }" → "${ op.new_string }"${ countStr }`)
  }

  await obsidian.updateFile(entry, content)
  markSeen(findEntry(name))

  const summary = results.length === 1
      ? `Replaced: ${ results[0] }`
      : `Replaced ${ results.length }:\n- ${ results.join('\n- ') }`

  ev.ok(summary.split('\n')[0])
  return { text: summary }
}
