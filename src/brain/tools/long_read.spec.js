import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.LONG_READ,
  access: ACCESS.READ,
  group: TOOL_GROUP.CORE,
  description: `Read or estimate sizes of multiple entries in one call.`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['read', 'focus', 'estimate'],
        description: 'read = full docs + links; focus = bodies only; estimate = metadata + word counts.',
      },
      documents: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: 'Entry names (case-insensitive)',
      },
    },
    required: ['operation', 'documents'],
  },
}
