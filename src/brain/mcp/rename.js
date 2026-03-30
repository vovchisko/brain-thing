import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.RENAME,
  description: `Rename an entry and update all wikilinks across the knowledge base.

Backlinks across all entries will be updated automatically.
New name must be unique.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Current entry name' },
      new_name: { type: 'string', description: 'New entry name — must be filesystem-safe (no \\ / : * ? " < > |)' },
    },
    required: [ 'name', 'new_name' ],
  },
}

export const route = { method: 'POST', path: TOOLS.RENAME }
