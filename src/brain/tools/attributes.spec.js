import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.ATTRIBUTES,
  access: ACCESS.READ,
  group: TOOL_GROUP.CORE,
  description: `List attributes used across entries.`,
  inputSchema: {
    type: 'object',
    properties: {
      tags: { type: 'array', items: { type: 'string' }, description: 'Tag prefix filter (OR across array)' },
      project: { type: 'string', description: 'Project filter' },
    },
  },
}
