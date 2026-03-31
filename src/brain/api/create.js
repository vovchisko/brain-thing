import { obsidian }     from '../modules/obsidian.js'
import { validateName } from '../lib/utils.js'
import { ApiError }     from '../lib/api.js'
import { createBus }    from '../lib/bus.js'

const bus = createBus('create')

/**
 * Create a new entry.
 * @param {{ name: string, content: string, tags: string[] }} body
 */
export async function handleCreate ({ name, content, tags, ...rest }) {
  if (!name || typeof content !== 'string') {
    throw new ApiError(400, 'Missing required fields: name, content')
  }
  const nameError = validateName(name)
  if (nameError) throw new ApiError(400, `Invalid name: ${ nameError }`)

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    throw new ApiError(400, 'Missing required field: tags (non-empty array)')
  }

  const props = { ...rest, tags }

  const meta = [tags[0], rest.project].filter(Boolean).join(', ')
  const ev = bus.op(name, meta)
  try {
    await obsidian.createFile(name, content, props)
    ev.ok('created')
    return { text: `Created "${ name }"` }
  } catch (err) {
    if (err.message?.includes('already exists')) {
      ev.warn('already exists')
      return { text: `Entry "${ name }" already exists. Use "get" to read it or "replace"/"update" to modify.` }
    }
    if (err.code === 'ENOENT' || err.code === 'EINVAL') {
      return { text: `Cannot create "${ name }": name contains invalid characters.` }
    }
    throw err
  }
}
