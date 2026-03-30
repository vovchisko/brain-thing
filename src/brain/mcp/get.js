import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.GET,
  description: `Get entry by exact name.

Returns entry with metadata fields (name, tags, summary, etc.) and markdown content.
Also shows backlinks (entries referencing this one) and missing/empty outgoing links if any.

Usage:
- Use exact entry name (case-insensitive)
- If entry not found, returns semantic suggestions
- Use [[wikilinks]] format when referencing entries in content`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
    },
    required: [ 'name' ],
  },
}

export const route = { method: 'POST', path: TOOLS.GET }
