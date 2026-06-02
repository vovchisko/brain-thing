import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.WHAT_IS,
  access: ACCESS.READ,
  group: TOOL_GROUP.CORE,
  description: `Semantic search.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural-language query' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tag prefix filter (OR across array)' },
      project: { type: 'string', description: 'Project filter' },
    },
    required: ['query'],
  },
}
