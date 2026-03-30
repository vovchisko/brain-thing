import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.CREATE,
  description: `Create a new entry.

Requires name, content, and at least one tag. Additional fields (status, priority, due, etc.) are passed as extra JSON keys alongside the required ones — they become frontmatter properties on the entry.

Example: { name: "My Task", content: "...", tags: ["work"], status: "active", priority: 3 }`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name (becomes filename)' },
      content: { type: 'string', description: 'Content (markdown, supports [[wikilinks]])' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags (required, non-empty)' },
    },
    additionalProperties: true,
    required: ['name', 'content', 'tags'],
  },
}

export const route = { method: 'POST', path: TOOLS.CREATE }
