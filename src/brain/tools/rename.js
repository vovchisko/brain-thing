import { TOOLS }                            from '../../shared/constants.js'
import { obsidian }                         from '../modules/obsidian.js'
import { ApiError }                         from '../lib/api.js'
import { validateName }                     from '../lib/utils.js'
import { entryNotFoundMessage, findEntry }  from './_helpers.js'
import { createBus }                        from '../lib/bus.js'

const bus = createBus('rename')

export const tool = {
  name: TOOLS.RENAME,
  description: `Rename an entry and update all wikilinks across the knowledge base.

Backlinks across all entries will be updated automatically.
New name must be unique.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Current entry name' },
      new_name: { type: 'string', description: 'New entry name — must be filesystem-safe (no \\ / : * ? " < > |)' },
    },
    required: [ 'name', 'new_name' ],
  },
}

export async function handle ({ name, new_name }) {
  if (!name) throw new ApiError(400, 'Missing required field: name')
  if (!new_name) throw new ApiError(400, 'Missing required field: new_name')
  if (name === new_name) throw new ApiError(400, 'New name is the same as current name')

  const nameError = validateName(new_name)
  if (nameError) throw new ApiError(400, `Invalid new_name: ${ nameError }`)

  const ev = bus.op(`${ name } → ${ new_name }`)
  const entry = findEntry(name)
  if (!entry) {
    ev.warn('not found')
    return { text: await entryNotFoundMessage(name) }
  }

  if (findEntry(new_name)) {
    return { text: `Cannot rename "${ name }" → "${ new_name }": entry "${ new_name }" already exists.` }
  }

  const { updatedFiles } = await obsidian.renameFile(entry, new_name)

  const refs = updatedFiles > 0 ? `${ updatedFiles } refs updated` : 'done'
  ev.ok(refs)
  return { text: `Renamed "${ name }" → "${ new_name }"${ updatedFiles > 0 ? ` (updated ${ updatedFiles } references)` : '' }` }
}
