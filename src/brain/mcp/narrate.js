import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.NARRATE,
  description: `Enable TTS narration for an entry. This is a mutation: sets the "narrate" field to the collection name and pre-chunks the content for synthesis. Reports any chunking issues (oversized segments, problematic punctuation).`,
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
