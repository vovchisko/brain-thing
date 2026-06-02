import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.CREATE,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.CORE,
  description: `Create a new entry.`,
  inputSchema: {
    type: 'object',
    required: ['name', 'content', 'attributes'],
    properties: {
      name: { type: 'string', description: 'Unique entry name' },
      content: { type: 'string', description: 'Markdown body; supports [[wikilinks]]' },
      attributes: {
        type: 'object',
        required: ['tags'],
        properties: {
          tags: { type: 'array', minItems: 1, items: { type: 'string' } },
        },
      },
    },
  },
}
