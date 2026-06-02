import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DB_UPDATE,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.DATABASE,
  description: `Patch fields of a row by id. Only the keys present in "data" are changed; pass null to clear a field. Reference and subset fields take the id (or array of ids) of rows in the target collection — never names. Date fields accept "YYYY-MM-DD", an ISO timestamp, epoch ms, or "now"/"today"; values without a timezone are read in local time.`,
  inputSchema: {
    type: 'object',
    properties: {
      collection: { type: 'string', description: 'Collection name (see db_schema).' },
      id: { type: 'string', description: 'Row id.' },
      data: { type: 'object', description: 'Partial field values to apply.' },
    },
    required: ['collection', 'id', 'data'],
  },
}
