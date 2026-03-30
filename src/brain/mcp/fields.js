import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.FIELDS,
  description: `Introspect frontmatter fields across entries.

Shows all fields, their types, how many entries have them, and value summaries.
Use to discover what fields exist before using the search tool.

Filter by tags or scope to see fields specific to a context.`,
  inputSchema: {
    type: 'object',
    properties: {
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (prefix match, OR)' },
      scope: { type: 'string', description: 'Filter entries by scope name' },
    },
  },
}

export const route = { method: 'POST', path: TOOLS.FIELDS }
