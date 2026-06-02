import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DB_GET,
  access: ACCESS.READ,
  group: TOOL_GROUP.DATABASE,
  description: `Read a single row by id from a collection. Reference/subset fields return ids; see db_schema for which collection each points to.`,
  inputSchema: {
    type: 'object',
    properties: {
      collection: { type: 'string', description: 'Collection name (see db_schema).' },
      id: { type: 'string', description: 'Row id.' },
    },
    required: ['collection', 'id'],
  },
}
