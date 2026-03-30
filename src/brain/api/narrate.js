import { obsidian }                        from '../modules/obsidian.js'
import { ApiError }                        from '../lib/api.js'
import { chunkText }                       from '../lib/chunker.js'
import { entryNotFoundMessage, findEntry } from './_helpers.js'
import { createBus }                       from '../lib/bus.js'

const bus = createBus('narrate')

/**
 * Set narrate field on entry and report chunking issues.
 * @param {{ name: string, collection: string }} body
 */
export async function handleNarrate ({ name, collection }) {
  const ev = bus.op(name, collection)
  if (!name) throw new ApiError(400, 'Missing required field: name')
  if (!collection) throw new ApiError(400, 'Missing required field: collection')

  const entry = findEntry(name)
  if (!entry) { ev.warn('not found'); return { text: await entryNotFoundMessage(name) } }

  if (!entry.content?.trim()) {
    throw new ApiError(400, `Entry "${ name }" has no content to narrate`)
  }

  // Don't allow changing collection if already set
  if (entry.narrate && typeof entry.narrate === 'string') {
    const existing = entry.narrate.replace(/--\S+/g, '').trim()
    if (existing && existing !== collection) {
      throw new ApiError(400, `Narrate already set to "${ existing }" — cannot change collection`)
    }
  }

  // Pre-chunk to report issues
  const { chunks, warnings } = chunkText(entry.content)
  const force = collection.includes('--force')
  const cleanCollection = collection.replace(/--force/g, '').trim()

  if (warnings.length && !force) {
    ev.warn(`${ warnings.length } chunking issues`)
    return {
      text: `Entry "${ name }" has ${ warnings.length } chunking issue(s):\n${ warnings.map(w => `- ${ w }`).join('\n') }\n\nFix the content or re-run with --force: narrate { name: "${ name }", collection: "${ cleanCollection } --force" }`,
    }
  }

  // Set narrate field — watcher will pick it up and send to TTS
  const narrateValue = force ? cleanCollection + ' --force' : cleanCollection
  await obsidian.updateFile(entry, entry.content, { narrate: narrateValue })

  let response = `Narrate set on "${ name }" (${ chunks.length } chunks)`
  if (warnings.length) {
    response += `\n\nChunking warnings (forced):\n${ warnings.map(w => `- ${ w }`).join('\n') }`
  }

  ev.ok(response.split('\n')[0])
  return { text: response }
}
