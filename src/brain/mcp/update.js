import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.UPDATE,
  description: `Update entry fields.

Any field can be updated except read-only ones (name, source_file, content_hash).
Array fields (tags, aliases, related) must be arrays.

Usage:
- Pass array of {property, value} objects
- Arrays replace entirely, not merge
- Use "get" first to see current values before updating

Example: fields: [{property: "tags", value: ["lore/character"]}, {property: "state", value: "draft"}]`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            property: { type: 'string', description: 'Field name' },
            value: { description: 'New value (string or array)' },
          },
          required: [ 'property', 'value' ],
        },
        description: 'Array of {property, value} objects',
      },
    },
    required: [ 'name', 'fields' ],
  },
}

export const route = { method: 'POST', path: TOOLS.UPDATE }
