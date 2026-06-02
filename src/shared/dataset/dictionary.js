/**
 * Wire names.
 *   RPC.*   — messages renderer sends to brain (request/response).
 *   EVENT.* — messages brain pushes to renderer (broadcast).
 *
 * Both are just `name` strings on the wire; the IPC dispatcher uses the same
 * surface as the original WebSocket transport.
 */

export const EVENT = {
  ITEM_CREATED:   'item.created',
  ITEM_UPDATED:   'item.updated',
  ITEM_DELETED:   'item.deleted',
  SCHEMA_CREATED: 'schema.created',
  SCHEMA_UPDATED: 'schema.updated',
  SCHEMA_DELETED: 'schema.deleted',
}

export const RPC = {
  COLLECTION_LIST: 'collection.list',
  COLLECTION_GET: 'collection.get',
  COLLECTION_CREATE: 'collection.create',
  COLLECTION_CREATE_MANY: 'collection.createMany',
  COLLECTION_UPDATE: 'collection.update',
  COLLECTION_DELETE: 'collection.delete',
  COLLECTION_DELETE_MANY: 'collection.deleteMany',

  SCHEMA_LIST: 'schema.list',
  SCHEMA_GET: 'schema.get',
  SCHEMA_EDIT: 'schema.edit',   // one DDL op: table + metadata + field
}

// DDL verbs for db_schema_edit — one flat, SQL-flavoured set (table + field).
export const SCHEMA_EDIT = {
  CREATE:           'create',            // new collection (carries initial props)
  DELETE:           'delete',            // drop the collection + all rows
  SET_DESCRIPTION:  'set_description',
  SET_DISPLAY_PROP: 'set_display_prop',
  SET_IDGEN:        'set_idgen',          // change the id prefix (cascades: rewrites every id + inbound ref)
  ADD_FIELD:        'add_field',
  REMOVE_FIELD:     'remove_field',
  UPDATE_FIELD:     'update_field',      // retype/reformat in place (not the key)
  RENAME_FIELD:     'rename_field',      // preserves every row's value
}

export const TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  DATE: 'date',
  ARRAY: 'array',
  ENUM: 'enum',
  REFERENCE: 'reference',   // single id → another collection (rules.referenceTo)
  SUBSET: 'subset',         // list of ids → another collection (rules.referenceTo)
}

// Decoration only — how a scalar value is rendered/edited. Structural meaning
// (referential integrity) lives in TYPES, not here. reference/subset/array are
// format-free (one representation each), so they don't appear in FORMATS_BY_TYPE.
export const FORMATS = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  CHECKBOX: 'checkbox',
  DATEPICKER: 'datepicker',
  SELECT: 'select',
}

// Which formats are valid for each type (first entry = the default). Single
// source of truth for engine (format normalisation) and UI (field editor).
// Types absent here are format-free (array, reference, subset).
export const FORMATS_BY_TYPE = {
  [TYPES.STRING]:  [ FORMATS.TEXT, FORMATS.TEXTAREA ],
  [TYPES.NUMBER]:  [ FORMATS.TEXT ],
  [TYPES.BOOLEAN]: [ FORMATS.CHECKBOX ],
  [TYPES.DATE]:    [ FORMATS.DATEPICKER ],
  [TYPES.ENUM]:    [ FORMATS.SELECT ],
}

export const ERR = {
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
}

export const ERR_HTTP = {
  [ERR.UNEXPECTED_ERROR]: 500,
  [ERR.NOT_FOUND]: 404,
  [ERR.BAD_REQUEST]: 400,
  [ERR.CONFLICT]: 409,
  [ERR.SERVICE_UNAVAILABLE]: 503,
}

export class ErrorGeneric {
  constructor (code, text = '') {
    this.code = code
    this.text = text
    this.statusCode = ERR_HTTP[code] || 500
  }
}
