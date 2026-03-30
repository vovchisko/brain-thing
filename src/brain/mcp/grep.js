import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.GREP,
  description: `Literal text search - finds exact matches across all entries.

Unlike what_is (semantic), this searches for exact text in title, content, and summary.

Results grouped:
- Title matches first
- Content matches sorted by occurrence count

Case-insensitive. Use tags/scope to narrow results.`,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to find' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (prefix match, OR)' },
      scope: { type: 'string', description: 'Filter by scope name' },
    },
    required: ['text'],
  },
}

export const route = { method: 'POST', path: TOOLS.GREP }
