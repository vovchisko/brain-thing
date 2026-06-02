import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.SEARCH,
  access: ACCESS.READ,
  group: TOOL_GROUP.CORE,
  description: `Search entries by attribute value.`,
  inputSchema: {
    type: 'object',
    properties: {
      filters: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            attribute: { type: 'string' },
            value: {},
            op: {
              type: 'string',
              enum: ['$eq', '$gt', '$gte', '$lt', '$lte', '$any', '$all'],
              default: '$eq',
              description: '$eq: any type. $gt/$gte/$lt/$lte: number or date. $any/$all: list. Dates use "YYYY-MM-DD"; list operators require an array value.',
            },
          },
          required: ['attribute', 'value'],
        },
      },
      project: { type: 'string', description: 'Project filter' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tag prefix filter (OR across array)' },
      limit: { type: 'number', default: 50, maximum: 200 },
    },
    required: ['filters'],
  },
}
