import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.TAGS_LIST,
  description: `Browse tags in the knowledge base.

Without parameters: all tags with entry counts.
With tag: subtags under that prefix + entries at that level.

Use to navigate the tag hierarchy before searching.`,
  inputSchema: {
    type: 'object',
    properties: {
      tag: { type: 'string', description: 'Tag prefix to drill into (e.g. "eo" or "eo/game")' },
    },
  },
}

export const route = { method: 'POST', path: TOOLS.TAGS_LIST }
