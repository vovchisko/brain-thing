import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.DELETE,
  description: `Delete an entry from the knowledge base.

Usage:
- Verify entry name with "get" before deleting
- This action cannot be undone
- Backlinks from other entries will become broken`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
    },
    required: [ 'name' ],
  },
}

export const route = { method: 'POST', path: TOOLS.DELETE }
