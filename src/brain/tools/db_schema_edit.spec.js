import { TOOLS, ACCESS, TOOL_GROUP } from '../../shared/specs.js'
import { TYPES, FORMATS, SCHEMA_EDIT } from '../../shared/dataset/dictionary.js'

const FIELD = {
  type: 'object',
  properties: {
    key:    { type: 'string' },
    type:   { type: 'string', enum: Object.values(TYPES) },
    format: { type: 'string', enum: Object.values(FORMATS) },
    def:    {},
    rules:  { type: 'object', description: 'options[] for enum; referenceTo for reference/subset; precision for date; required for required fields.' },
  },
  required: ['key', 'type'],
}

export const spec = {
  name: TOOLS.DB_SCHEMA_EDIT,
  access: ACCESS.WRITE,
  group: TOOL_GROUP.DATABASE,
  description: `Change a collection's structure — one DDL op, applied and persisted immediately (like SQL ALTER). A field's "key" is its column name. Ops:
- { op:"create", prefix, description?, displayProp?, props?[] } — new collection (name = the "name" arg). "prefix" is REQUIRED: ids are "<prefix>-<n>" (e.g. prefix "TASK" → "TASK-1"); no spaces, no leading digit, unique across collections. Each prop is { key, type, format?, def?, rules? }.
- { op:"delete", force? } — drop the collection and all its rows. If other collections reference it, the drop is refused unless force:true, which also clears those references.
- { op:"set_description", value }
- { op:"set_display_prop", value } — value must be an existing field key (or "" to clear).
- { op:"set_idgen", prefix } — change the id prefix; rewrites every id and every reference to this collection in one atomic cascade.
- { op:"add_field", field:{ key, type, format, def?, rules? } } — existing rows get the field's default.
- { op:"remove_field", key } — drop the field and its data.
- { op:"update_field", key, changes:{ type?, format?, def?, rules? } } — retype/reformat in place; CANNOT change the key (use rename_field). Existing values are re-coerced.
- { op:"rename_field", key, to } — rename the key, preserving every row's value.
To make several changes, call this once per change. Returns the full schema.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Collection name: letters/digits/_/- , starting with a letter, max 64 chars.' },
      op: {
        type: 'object',
        properties: {
          op:          { type: 'string', enum: Object.values(SCHEMA_EDIT) },
          force:       { type: 'boolean', description: 'For delete: drop even if other collections reference this one, clearing those references.' },
          description: { type: 'string', description: 'For create / set_description.' },
          displayProp: { type: 'string', description: 'For create.' },
          prefix:      { type: 'string', description: 'For create (required) / set_idgen: id prefix, "<prefix>-<n>". No spaces, no leading digit, unique across collections.' },
          value:       { type: 'string', description: 'For set_description / set_display_prop.' },
          key:         { type: 'string', description: 'Target field key (remove_field/update_field/rename_field).' },
          to:          { type: 'string', description: 'New key (rename_field).' },
          field:       { ...FIELD, description: 'Field definition for add_field.' },
          changes:     { type: 'object', description: 'Partial field changes for update_field (type/format/def/rules); not the key.' },
          props:       { type: 'array', description: 'Initial fields for create.', items: FIELD },
        },
        required: ['op'],
      },
    },
    required: ['name', 'op'],
  },
}
