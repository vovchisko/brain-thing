import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'

export const spec = {
  name: TOOLS.DB_SCHEMA,
  access: ACCESS.READ,
  group: TOOL_GROUP.DATABASE,
  description: `Read database structure. With no "name", lists every collection and its fields — call this first to discover collection names and field types. With a "name", returns that one collection's full schema { name, description, displayProp, props[] }. Each field is { key, type, format, def?, rules? }; the "key" is the field's column name.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Collection name. Omit to list all collections.' },
    },
  },
}
