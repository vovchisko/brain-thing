import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DIAGNOSTIC,
  access: ACCESS.READ,
  group: TOOL_GROUP.CORE,
  description: `Report entries with issues by category.`,
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['links', 'summary'],
        description: 'links: broken or empty [[wikilinks]]. summary: missing summary. Omit for all.',
      },
      project: { type: 'string', description: 'Project filter' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tag prefix filter (OR across array)' },
    },
  },
}
