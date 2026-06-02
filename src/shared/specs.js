// Tool-related constants. Renderer-safe.

export const ACCESS = Object.freeze({
  READ:  'read',
  WRITE: 'write',
})

export const TOOL_GROUP = Object.freeze({
  CORE:     'core',
  SETTINGS: 'settings',
  DATABASE: 'database',
})

export const TOOLS = Object.freeze({
  GET:            'get',
  WHAT_IS:        'what_is',
  GREP:           'grep',
  LOOK_AROUND:    'look_around',
  TAGS_LIST:      'tags_list',
  CREATE:         'create',
  EDIT:           'edit',
  DELETE:         'delete',
  RENAME:         'rename',
  ATTRIBUTES:     'attributes',
  SEARCH:         'search',
  DIAGNOSTIC:     'diagnostic',
  PROJECT_CONFIG: 'project_config',
  LONG_READ:      'long_read',

  DB_SCHEMA:         'db_schema',
  DB_SCHEMA_EDIT:    'db_schema_edit',
  DB_QUERY:          'db_query',
  DB_GET:            'db_get',
  DB_CREATE:         'db_create',
  DB_CREATE_MANY:    'db_create_many',
  DB_UPDATE:         'db_update',
  DB_DELETE:         'db_delete',
  DB_DELETE_MANY:    'db_delete_many',
})
