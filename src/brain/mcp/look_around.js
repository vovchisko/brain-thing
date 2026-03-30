import { TOOLS } from '../config.js'

export const tool = {
  name: TOOLS.LOOK_AROUND,
  description: `Overview of the knowledge base - use this first to orient yourself.

Returns:
- Total entry count
- Scopes with entry counts and matching rules
- All tags with entry counts
- Guidelines for working with this knowledge base (if available)

Usage:
- Call without parameters
- Helps understand scope and structure before diving in
- Use returned scope/tag names for filtering in other tools`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

export const route = { method: 'GET', path: TOOLS.LOOK_AROUND }
