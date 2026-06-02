import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.RENAME,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.CORE,
  description: `Rename an entry. Existing [[wikilinks]] to it are updated.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Current name' },
      new_name: { type: 'string', minLength: 1, maxLength: 200, description: 'New name. Must be unique and filesystem-safe.' },
    },
    required: ['name', 'new_name'],
  },
}
