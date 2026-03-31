import { TOOLS } from '../../shared/constants.js'

export const tool = {
  name: TOOLS.LOOK_AROUND,
  description: `Overview of the knowledge base - use this first to orient yourself.

Returns:
- Total entry count
- Projects with entry counts
- All tags with entry counts
- Guidelines for working with this knowledge base (if available)

Usage:
- Call without parameters
- Helps understand projects and structure before diving in
- Use returned project/tag names for filtering in other tools`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

export const route = { method: 'POST', path: TOOLS.LOOK_AROUND }
