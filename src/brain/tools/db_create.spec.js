import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DB_CREATE,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.DATABASE,
  description: `Insert a row into a collection. The server assigns the id. Provide field values per the collection schema (see db_schema); omitted fields take their defaults. Reference and subset fields take the id (or array of ids) of rows in the target collection — never names; run db_query on that collection to find the id. Date fields accept "YYYY-MM-DD", "YYYY-MM-DD HH:MM", an ISO timestamp, epoch ms, or the sentinels "now"/"today"; values without a timezone are read in local time.`,
  inputSchema: {
    type: 'object',
    properties: {
      collection: { type: 'string', description: 'Collection name (see db_schema).' },
      data: { type: 'object', description: 'Field values keyed by schema prop key.' },
    },
    required: ['collection', 'data'],
  },
}
