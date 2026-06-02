import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DB_DELETE,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.DATABASE,
  description: `Delete a row by id from a collection. Irreversible. If other rows reference this one (reference/subset fields), the delete is refused and the reply lists what points at it — pass force:true to delete anyway and clear those references (single → null, list → id removed).`,
  inputSchema: {
    type: 'object',
    properties: {
      collection: { type: 'string', description: 'Collection name (see db_schema).' },
      id: { type: 'string', description: 'Row id.' },
      force: { type: 'boolean', description: 'Delete even when other rows reference this one, clearing those references. Default false.' },
    },
    required: ['collection', 'id'],
  },
}
