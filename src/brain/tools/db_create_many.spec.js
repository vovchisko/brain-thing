import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DB_CREATE_MANY,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.DATABASE,
  description: `Insert several rows into a collection in one call — all-or-nothing: every row is validated first, and if any fails (unknown field, missing required, bad reference id) NONE are inserted and the error names the offending row. Same per-row rules as db_create. Returns the new ids.`,
  inputSchema: {
    type: 'object',
    properties: {
      collection: { type: 'string', description: 'Collection name (see db_schema).' },
      rows: {
        type: 'array',
        minItems: 1,
        description: 'Rows to insert; each is a field-values object like db_create\'s "data".',
        items: { type: 'object' },
      },
    },
    required: ['collection', 'rows'],
  },
}
