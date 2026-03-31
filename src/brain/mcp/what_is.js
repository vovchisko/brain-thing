import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.WHAT_IS,
  description: `Semantic search - finds entries by meaning, not just keywords.

High-confidence match (score ≥80%): returns full entry (frontmatter + entire content) — no follow-up "get" needed.
Low-confidence matches: returns a ranked list with names, tags, and similarity scores.

Usage:
- Describe what you're looking for in natural language
- Works even if you don't know exact terminology
- Filter by tags or project to narrow results
- Exact name match returns full entry immediately`,
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
