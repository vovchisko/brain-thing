import { obsidian }                            from '../modules/obsidian.js'
import { validateName }                        from '../lib/utils.js'
import { validateAttributes }                  from '../models/Entry.js'
import { ApiError }                            from '../lib/api.js'
import { findEntry, markSeen, typeWarnings }   from './_helpers.js'
import { createBus }                           from '../lib/bus.js'

const bus = createBus('create')

function formatError (e) {
  return e.reason
}

export async function handle ({ name, content, attributes }) {
  if (!name || typeof content !== 'string') {
    throw new ApiError(400, 'Missing required: name, content')
  }
  const nameError = validateName(name)
  if (nameError) throw new ApiError(400, `Invalid name: ${ nameError }`)

  const tags = attributes?.tags
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    throw new ApiError(400, 'Missing required: attributes.tags (non-empty array)')
  }

  const { props, errors } = validateAttributes(attributes)
  if (errors.length > 0) {
    throw new ApiError(400, `Create failed:\n- ${ errors.map(formatError).join('\n- ') }`)
  }

  const warnings = typeWarnings(props)

  const meta = [tags[0], props.project].filter(Boolean).join(', ')
  const ev = bus.op(name, meta)
  try {
    await obsidian.createFile(name, content, props)
    markSeen(findEntry(name))
    ev.ok('created')
    let text = `Created "${ name }"`
    if (warnings.length) text += `\n\nWarnings:\n- ${ warnings.join('\n- ') }`
    return { text }
  } catch (err) {
    if (err.message?.includes('already exists')) {
      ev.warn('already exists')
      return { text: `Entry "${ name }" already exists. Use "get" to read it or "edit" to modify.` }
    }
    if (err.code === 'ENOENT' || err.code === 'EINVAL') {
      return { text: `Cannot create "${ name }": name contains invalid characters.` }
    }
    throw err
  }
}
