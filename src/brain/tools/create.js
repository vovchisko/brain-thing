import { TOOLS }                               from '../../shared/constants.js'
import { obsidian }                            from '../modules/obsidian.js'
import { validateName }                        from '../lib/utils.js'
import { ApiError }                            from '../lib/api.js'
import { findEntry, markSeen, typeWarnings }   from './_helpers.js'
import { createBus }                           from '../lib/bus.js'

const bus = createBus('create')

export const tool = {
  name: TOOLS.CREATE,
  description: `Create a new entry.

Requires name, content, and at least one tag. Pass extra frontmatter fields (project, status, priority, due, etc.) as top-level JSON keys.

When the vault has projects (see look_around), attach the entry to one by passing project: "<name>". Omit only if this entry genuinely belongs to no project.

Example: { name: "My Task", content: "...", tags: ["work"], project: "Work", status: "active", priority: 3 }`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name (becomes filename)' },
      content: { type: 'string', description: 'Content (markdown, supports [[wikilinks]])' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags (required, non-empty)' },
      project: { type: 'string', description: 'Attach to existing project from look_around' },
    },
    additionalProperties: true,
    required: ['name', 'content', 'tags'],
  },
}

export const injectFields = 'write'

export async function handle ({ name, content, tags, ...rest }) {
  if (!name || typeof content !== 'string') {
    throw new ApiError(400, 'Missing required fields: name, content')
  }
  const nameError = validateName(name)
  if (nameError) throw new ApiError(400, `Invalid name: ${ nameError }`)

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    throw new ApiError(400, 'Missing required field: tags (non-empty array)')
  }

  const props = { ...rest, tags }
  const warnings = typeWarnings(props)

  const meta = [tags[0], rest.project].filter(Boolean).join(', ')
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
      return { text: `Entry "${ name }" already exists. Use "get" to read it or "replace"/"update" to modify.` }
    }
    if (err.code === 'ENOENT' || err.code === 'EINVAL') {
      return { text: `Cannot create "${ name }": name contains invalid characters.` }
    }
    throw err
  }
}
