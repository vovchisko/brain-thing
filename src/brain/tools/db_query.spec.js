import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DB_QUERY,
  access: ACCESS.READ,
  group: TOOL_GROUP.DATABASE,
  description: `Query rows from a collection with optional filters, sort, and pagination. Use db_schema first to learn the collection name and its fields.`,
  inputSchema: {
    type: 'object',
    properties: {
      collection: { type: 'string', description: 'Collection name (see db_schema).' },
      filters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Field key.' },
            op: {
              type: 'string',
              enum: ['eq', 'in', 'lt', 'gt', 'contains', 'starts', 'has', 'hasAny'],
              description: 'eq/lt/gt: scalar. in/hasAny: array value. has: membership in an array field. contains/starts: text.',
            },
            value: { description: 'Comparison value; coerced to the field type. For reference/subset fields, match by id (use has/hasAny with ids).' },
          },
          required: ['key', 'op', 'value'],
        },
      },
      sort: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          dir: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
        required: ['key'],
      },
      offset: { type: 'number', default: 0, minimum: 0 },
      limit: { type: 'number', default: 50, maximum: 200 },
    },
    required: ['collection'],
  },
}
