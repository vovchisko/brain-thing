import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DB_DELETE_MANY,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.DATABASE,
  description: `Delete several rows by id in one call — all-or-nothing: if any id is missing, none are deleted. Like db_delete, if any listed row is referenced by other rows the batch is refused (the reply lists what points at them) unless force:true, which deletes them and clears those references. Query first (db_query) to get the ids.`,
  inputSchema: {
    type: 'object',
    properties: {
      collection: { type: 'string', description: 'Collection name (see db_schema).' },
      ids: {
        type: 'array',
        minItems: 1,
        description: 'Row ids to delete.',
        items: { type: 'string' },
      },
      force: { type: 'boolean', description: 'Delete even when some rows are referenced, clearing those references. Default false.' },
    },
    required: ['collection', 'ids'],
  },
}
