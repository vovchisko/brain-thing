import { TOOLS }                            from '../../shared/constants.js'
import { obsidian }                         from '../modules/obsidian.js'
import { ApiError }                         from '../lib/api.js'
import { entryNotFoundMessage, findEntry }  from './_helpers.js'
import { createBus }                        from '../lib/bus.js'

const bus = createBus('delete')

export const tool = {
  name: TOOLS.DELETE,
  description: `Delete an entry from the knowledge base.

Usage:
- Verify entry name with "get" before deleting
- This action cannot be undone
- Backlinks from other entries will become broken`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
    },
    required: [ 'name' ],
  },
}

export async function handle ({ name }) {
  if (!name) throw new ApiError(400, 'Missing required field: name')

  const ev = bus.op(name)
  const entry = findEntry(name)

  if (!entry) {
    ev.warn('not found')
    return { text: await entryNotFoundMessage(name) }
  }

  await obsidian.deleteFile(entry)
  ev.ok('deleted')
  return { text: `Deleted "${ name }"` }
}
