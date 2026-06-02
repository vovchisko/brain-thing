import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DELETE,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.CORE,
  description: `Delete an entry. Existing [[wikilinks]] to it become broken.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Entry name' },
    },
    required: ['name'],
  },
}
