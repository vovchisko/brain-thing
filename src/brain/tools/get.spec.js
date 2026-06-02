import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.GET,
  access: ACCESS.READ,
  group: TOOL_GROUP.CORE,
  description: `Read an entry.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name (case-insensitive)' },
      operation: {
        type: 'string',
        enum: ['read', 'focus', 'estimate'],
        default: 'read',
        description: 'read = full doc + links; focus = body only; estimate = metadata + word count (no body).',
      },
    },
    required: ['name'],
  },
}
