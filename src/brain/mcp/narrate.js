import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.NARRATE,
  description: `Enable TTS narration for an entry. This is a mutation: sets the "narrate" field and pre-chunks content for synthesis.

If chunking issues are found (oversized segments), narration is blocked. Add "--force" to the collection name to proceed anyway: { collection: "my-collection --force" }`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
      collection: { type: 'string', description: 'Output group name' },
    },
    required: [ 'name', 'collection' ],
  },
}

export const feature = 'tts'

export const route = { method: 'POST', path: TOOLS.NARRATE }
