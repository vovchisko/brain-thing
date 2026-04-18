import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.WHAT_IS,
  description: `Semantic search - finds entries by meaning, not just keywords.

Always returns a ranked list (up to 5) with score, project/tags, a short preview, and word count. To read an entry's full content, follow up with the \`get\` tool.

Usage:
- Describe what you're looking for in natural language
- Works even if you don't know exact terminology
- Filter by tags or project to narrow results
- Word count helps estimate how much content a \`get\` will return`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (prefix match, OR)' },
      project: { type: 'string', description: 'Filter by project' },
    },
    required: ['query'],
  },
}

export const route = { method: 'POST', path: TOOLS.WHAT_IS }
