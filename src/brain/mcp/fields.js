import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.FIELDS,
  description: `Introspect frontmatter fields across entries.

Shows all fields, their types, how many entries have them, and value summaries.
Use to discover what fields exist before using the search tool.

Filter by tags or project to see fields specific to a context.`,
  inputSchema: {
    type: 'object',
    properties: {
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (prefix match, OR)' },
      project: { type: 'string', description: 'Filter by project' },
    },
  },
}

export const route = { method: 'POST', path: TOOLS.FIELDS }
