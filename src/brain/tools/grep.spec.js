import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.GREP,
  access: ACCESS.READ,
  group: TOOL_GROUP.CORE,
  description: `Literal text search across entries.`,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Literal text to find' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tag prefix filter (OR across array)' },
      project: { type: 'string', description: 'Project filter' },
    },
    required: ['text'],
  },
}
