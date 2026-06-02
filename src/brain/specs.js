import { spec as get }           from './tools/get.spec.js'
import { spec as whatIs }        from './tools/what_is.spec.js'
import { spec as grep }          from './tools/grep.spec.js'
import { spec as lookAround }    from './tools/look_around.spec.js'
import { spec as tagsList }      from './tools/tags_list.spec.js'
import { spec as create }        from './tools/create.spec.js'
import { spec as edit }          from './tools/edit.spec.js'
import { spec as del }           from './tools/delete.spec.js'
import { spec as rename }        from './tools/rename.spec.js'
import { spec as attributes }    from './tools/attributes.spec.js'
import { spec as search }        from './tools/search.spec.js'
import { spec as diagnostic }    from './tools/diagnostic.spec.js'
import { spec as projectConfig } from './tools/project_config.spec.js'
import { spec as longRead }      from './tools/long_read.spec.js'
import { spec as dbSchema }       from './tools/db_schema.spec.js'
import { spec as dbSchemaEdit }   from './tools/db_schema_edit.spec.js'
import { spec as dbQuery }        from './tools/db_query.spec.js'
import { spec as dbGet }          from './tools/db_get.spec.js'
import { spec as dbCreate }       from './tools/db_create.spec.js'
import { spec as dbCreateMany }   from './tools/db_create_many.spec.js'
import { spec as dbUpdate }       from './tools/db_update.spec.js'
import { spec as dbDelete }       from './tools/db_delete.spec.js'
import { spec as dbDeleteMany }   from './tools/db_delete_many.spec.js'

export const SPECS = [
  get, whatIs, grep, lookAround, tagsList,
  create, edit, del, rename,
  attributes, search, diagnostic, projectConfig, longRead,
  dbSchema, dbSchemaEdit, dbQuery, dbGet, dbCreate, dbCreateMany, dbUpdate, dbDelete, dbDeleteMany,
]
