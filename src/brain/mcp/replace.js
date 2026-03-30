import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.REPLACE,
  description: `Find and replace text in entry content. Atomic — all or nothing.

Single mode: pass old_string + new_string (+ optional replace_all).
Batch mode: pass pairs array [{old_string, new_string, replace_all?}, ...].
Use one or the other, never both.

- old_string must exist in content; fails if not found
- If old_string appears multiple times and replace_all is false, operation fails (ambiguous match)
- In batch mode, all pairs are validated before any changes are applied
- Use "get" first to see current content`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
      old_string: { type: 'string', description: 'Text to replace' },
      new_string: { type: 'string', description: 'Replacement text' },
      replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
      pairs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            old_string: { type: 'string' },
            new_string: { type: 'string' },
            replace_all: { type: 'boolean' },
          },
          required: [ 'old_string', 'new_string' ],
        },
        description: 'Multiple replacements: [{old_string, new_string, replace_all?}, ...]',
      },
    },
    required: [ 'name' ],
  },
}

export const route = { method: 'POST', path: TOOLS.REPLACE }
