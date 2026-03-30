import { obsidian }                        from '../modules/obsidian.js'
import { ApiError }                        from '../lib/api.js'
import { entryNotFoundMessage, findEntry } from './_helpers.js'
import { createBus }                       from '../lib/bus.js'

const bus = createBus('delete')

export async function handleDelete ({ name }) {
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
