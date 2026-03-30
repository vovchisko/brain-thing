import { obsidian }                        from '../modules/obsidian.js'
import { ApiError }                        from '../lib/api.js'
import { entryNotFoundMessage, findEntry } from './_helpers.js'
import { createBus }                       from '../lib/bus.js'

const bus = createBus('replace')

function truncate (str, len = 40) {
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}

function countOccurrences (content, str) {
  return content.split(str).length - 1
}

/**
 * Find and replace text in entry content.
 * Supports single replacement or multiple pairs. Atomic - no changes if any find fails.
 * @param {{ name: string, old_string?: string, new_string?: string, replace_all?: boolean, pairs?: Array<{old_string: string, new_string: string, replace_all?: boolean}> }} body
 * @returns {Promise<{ text: string }>}
 */
export async function handleReplace ({ name, old_string, new_string, replace_all, pairs }) {
  if (!name) {
    throw new ApiError(400, 'Missing required field: name')
  }

  // Normalize to pairs array
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

  // Validate all operations first
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

  // Apply all replacements
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

  const summary = results.length === 1
      ? `Replaced: ${ results[0] }`
      : `Replaced ${ results.length }:\n- ${ results.join('\n- ') }`

  ev.ok(summary.split('\n')[0])
  return { text: summary }
}
