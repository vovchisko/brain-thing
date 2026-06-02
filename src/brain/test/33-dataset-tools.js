import { TOOLS, TOOL_GROUP } from '../../shared/specs.js'

/**
 * MCP tool surface for the dataset. Exercises the db_* tools over the HTTP
 * harness (fastify.inject) — the same path the MCP proxy uses. The dataset
 * module's own logic is covered by src/brain/dataset/test/*; here we only
 * confirm the tools are wired, reply as { text }, and surface errors cleanly.
 *
 * Surface: db_schema (read) / db_schema_edit (one DDL op) / db_create / db_query
 * / db_get / db_update / db_delete. Schema edits are single-op.
 */
export default async function ({ post, get, assert }) {
  // tools catalog includes the db_* group
  const { data: tools } = await get('tools')
  assert(tools.find(t => t.name === TOOLS.DB_SCHEMA), 'db_schema present in catalog')
  assert(tools.filter(t => t.group === TOOL_GROUP.DATABASE).length === 9, 'nine database tools')

  // empty state
  const empty = await post(TOOLS.DB_SCHEMA, {})
  assert(empty.status === 200, 'db_schema 200')
  assert(/no collections/i.test(empty.data.text), 'db_schema (no name) reports empty')

  // create a collection via db_schema_edit
  const created = await post(TOOLS.DB_SCHEMA_EDIT, {
    name: 'tasks',
    op: {
      op: 'create',
      prefix: 'TASK',
      description: 'Tasks',
      props: [
        { key: 'title', type: 'string', format: 'text', def: '' },
        { key: 'done', type: 'boolean', format: 'checkbox', def: false },
      ],
    },
  })
  assert(created.status === 200, 'db_schema_edit create 200')
  assert(/tasks/.test(created.data.text), 'create reply names collection')
  assert(/ids: TASK-/.test(created.data.text), 'create reply shows the id prefix')

  // it shows up in db_schema (list) and db_schema (one)
  const listed = await post(TOOLS.DB_SCHEMA, {})
  assert(/=== tasks/.test(listed.data.text), 'new collection listed')
  assert(/title: string/.test(listed.data.text), 'props rendered')

  const one = await post(TOOLS.DB_SCHEMA, { name: 'tasks' })
  assert(/=== tasks/.test(one.data.text), 'db_schema with name returns the schema')

  // row roundtrip: create → query → get → update → delete
  const row = await post(TOOLS.DB_CREATE, { collection: 'tasks', data: { title: 'write tests', done: false } })
  assert(/Created row TASK-1/.test(row.data.text), 'db_create returns the prefixed id TASK-1 (no #)')

  const q = await post(TOOLS.DB_QUERY, { collection: 'tasks' })
  assert(/write tests/.test(q.data.text), 'db_query shows the row')
  assert(/=== tasks ===/.test(q.data.text) && /done:boolean/.test(q.data.text), 'db_query leads with the table structure (Phase-2 header)')

  const got = await post(TOOLS.DB_GET, { collection: 'tasks', id: 'TASK-1' })
  assert(/title="write tests"/.test(got.data.text), 'db_get renders fields (strings quoted)')

  const upd = await post(TOOLS.DB_UPDATE, { collection: 'tasks', id: 'TASK-1', data: { done: true } })
  assert(upd.status === 200 && /updated/i.test(upd.data.text), 'db_update ok')
  const got2 = await post(TOOLS.DB_GET, { collection: 'tasks', id: 'TASK-1' })
  assert(/done=true/.test(got2.data.text), 'update persisted')

  const del = await post(TOOLS.DB_DELETE, { collection: 'tasks', id: 'TASK-1' })
  assert(/deleted/i.test(del.data.text), 'db_delete ok')
  const q2 = await post(TOOLS.DB_QUERY, { collection: 'tasks' })
  assert(/no rows/i.test(q2.data.text), 'row gone after delete')

  // P1 — unknown field on write soft-errors with guidance, not a silent drop
  const unknown = await post(TOOLS.DB_CREATE, { collection: 'tasks', data: { titel: 'typo' } })
  assert(/Unknown field "titel"/.test(unknown.data.text), 'unknown field named')
  assert(/Did you mean "title"/.test(unknown.data.text), 'closest field suggested')

  // errors surface as clean text, not a crash
  const bad = await post(TOOLS.DB_QUERY, { collection: 'ghost' })
  assert(bad.status === 200, 'bad collection still 200 (soft error)')
  assert(/does not exist/i.test(bad.data.text), 'bad collection explained')

  const badRow = await post(TOOLS.DB_GET, { collection: 'tasks', id: '999' })
  assert(/not found/i.test(badRow.data.text), 'missing row explained')

  // references: strict ids on input, bare id on output
  await post(TOOLS.DB_SCHEMA_EDIT, {
    name: 'authors',
    op: { op: 'create', prefix: 'AUT', description: 'Authors', props: [ { key: 'name', type: 'string', format: 'text', def: '' } ] },
  })
  const author = await post(TOOLS.DB_CREATE, { collection: 'authors', data: { name: 'George Orwell' } })
  assert(/Created row AUT-1/.test(author.data.text), 'author created AUT-1')

  await post(TOOLS.DB_SCHEMA_EDIT, {
    name: 'books',
    op: { op: 'create', prefix: 'BOOK', description: 'Books', props: [
      { key: 'title', type: 'string', format: 'text', def: '' },
      { key: 'author', type: 'reference', rules: { referenceTo: 'authors' }, def: null },
    ] },
  })
  const book = await post(TOOLS.DB_CREATE, { collection: 'books', data: { title: '1984', author: 'AUT-1' } })
  assert(/Created row BOOK-1/.test(book.data.text), 'book created with author ref')

  const bq = await post(TOOLS.DB_QUERY, { collection: 'books' })
  assert(/author=AUT-1/.test(bq.data.text), 'reference renders as bare id')
  assert(!/George Orwell/.test(bq.data.text), 'no human label leaks into row output')
  assert(/author:reference\(authors\)/.test(bq.data.text), 'sig maps the reference field to its collection (Phase-2)')

  const badRef = await post(TOOLS.DB_CREATE, { collection: 'books', data: { title: 'X', author: '999' } })
  assert(/not an id in "authors"/.test(badRef.data.text), 'bad reference id soft-errors with guidance')

  // row delete + inbound refs: blocked without force, then cascades-null
  const blocked = await post(TOOLS.DB_DELETE, { collection: 'authors', id: 'AUT-1' })
  assert(/referenced by/i.test(blocked.data.text) && /force/i.test(blocked.data.text), 'delete blocked names referrers + force')
  const stillThere = await post(TOOLS.DB_GET, { collection: 'authors', id: 'AUT-1' })
  assert(/AUT-1/.test(stillThere.data.text), 'blocked author still exists')
  const forced = await post(TOOLS.DB_DELETE, { collection: 'authors', id: 'AUT-1', force: true })
  assert(/[Cc]leared 1 reference/.test(forced.data.text), 'forced delete reports the cleared reference')
  const bAfter = await post(TOOLS.DB_GET, { collection: 'books', id: 'BOOK-1' })
  assert(/author=null/.test(bAfter.data.text), 'reference nulled after force delete')

  // collection delete is blocked while another collection references it (B10)
  const colBlocked = await post(TOOLS.DB_SCHEMA_EDIT, { name: 'authors', op: { op: 'delete' } })
  assert(/referenced by/i.test(colBlocked.data.text) && /force/i.test(colBlocked.data.text), 'collection delete blocked while referenced')

  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'books', op: { op: 'delete' } })
  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'authors', op: { op: 'delete' } })

  // update_field type change resets an incompatible format → note in the reply
  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'fmt', op: { op: 'create', prefix: 'FMT', props: [ { key: 'k', type: 'enum', format: 'select', rules: { options: [ 'a', 'b' ] }, def: 'a' } ] } })
  const noted = await post(TOOLS.DB_SCHEMA_EDIT, { name: 'fmt', op: { op: 'update_field', key: 'k', changes: { type: 'number', def: 0 } } })
  assert(/Note:/.test(noted.data.text) && /format/i.test(noted.data.text), 'type change resets incompatible format with a note')
  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'fmt', op: { op: 'delete' } })

  // pagination "…N more" accounts for offset (B6)
  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'paged', op: { op: 'create', prefix: 'PG', description: 'P', props: [ { key: 'n', type: 'number', format: 'text', def: 0 } ] } })
  for (let i = 1; i <= 5; i++) await post(TOOLS.DB_CREATE, { collection: 'paged', data: { n: i } })
  const pg0 = await post(TOOLS.DB_QUERY, { collection: 'paged', offset: 0, limit: 2 })
  assert(/3 more/.test(pg0.data.text), 'first page: 3 remaining')
  const pgMid = await post(TOOLS.DB_QUERY, { collection: 'paged', offset: 2, limit: 2 })
  assert(/1 more/.test(pgMid.data.text), 'mid page: remaining counts from offset')
  const pgLast = await post(TOOLS.DB_QUERY, { collection: 'paged', offset: 4, limit: 2 })
  assert(!/more/.test(pgLast.data.text), 'last page: no "more" footer')
  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'paged', op: { op: 'delete' } })

  // field ops: add_field / rename_field (preserves data) / remove_field (B4) — one op per call
  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'notes', op: { op: 'create', prefix: 'NOTE', description: 'Notes', props: [ { key: 'label', type: 'string', format: 'text', def: '' } ] } })
  await post(TOOLS.DB_CREATE, { collection: 'notes', data: { label: 'keep me' } })

  const added = await post(TOOLS.DB_SCHEMA_EDIT, { name: 'notes', op: { op: 'add_field', field: { key: 'pinned', type: 'boolean', format: 'checkbox', def: false } } })
  assert(/pinned: boolean/.test(added.data.text), 'add_field reflected in schema')

  const renamed = await post(TOOLS.DB_SCHEMA_EDIT, { name: 'notes', op: { op: 'rename_field', key: 'label', to: 'title' } })
  assert(/title: string/.test(renamed.data.text) && !/label: string/.test(renamed.data.text), 'rename_field reflected in schema')
  const nq = await post(TOOLS.DB_QUERY, { collection: 'notes' })
  assert(/title="keep me"/.test(nq.data.text), 'rename_field preserved the data (B4)')

  const badField = await post(TOOLS.DB_SCHEMA_EDIT, { name: 'notes', op: { op: 'rename_field', key: 'title', to: 'pinned' } })
  assert(/already exists/i.test(badField.data.text), 'rename to existing key soft-errors')

  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'notes', op: { op: 'remove_field', key: 'pinned' } })
  const afterRemove = await post(TOOLS.DB_SCHEMA, { name: 'notes' })
  assert(!/pinned/.test(afterRemove.data.text), 'remove_field reflected')

  // schema metadata ops — one op per call
  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'notes', op: { op: 'set_description', value: 'My notes' } })
  const meta = await post(TOOLS.DB_SCHEMA_EDIT, { name: 'notes', op: { op: 'set_display_prop', value: 'title' } })
  assert(/My notes/.test(meta.data.text) && /display: title/.test(meta.data.text), 'metadata ops applied')

  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'notes', op: { op: 'delete' } })

  // bulk: db_create_many (all-or-nothing) + db_delete_many
  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'bulk', op: { op: 'create', prefix: 'BULK', props: [ { key: 'n', type: 'number', format: 'text', def: 0 } ] } })
  const made = await post(TOOLS.DB_CREATE_MANY, { collection: 'bulk', rows: [ { n: 1 }, { n: 2 }, { n: 3 } ] })
  assert(/Created 3 row/.test(made.data.text), 'db_create_many inserts the batch')
  const badBatch = await post(TOOLS.DB_CREATE_MANY, { collection: 'bulk', rows: [ { n: 4 }, { n: 'oops' } ] })
  assert(/rows\[1\]/.test(badBatch.data.text), 'db_create_many is all-or-nothing and names the bad row')
  const cnt = await post(TOOLS.DB_QUERY, { collection: 'bulk' })
  assert(/3 rows/.test(cnt.data.text), 'failed batch inserted nothing')
  const delMany = await post(TOOLS.DB_DELETE_MANY, { collection: 'bulk', ids: ['BULK-1', 'BULK-2'] })
  assert(/Deleted 2 row/.test(delMany.data.text), 'db_delete_many removes the batch')
  await post(TOOLS.DB_SCHEMA_EDIT, { name: 'bulk', op: { op: 'delete' } })

  // drop the last collection — catalog empty again
  const dropped = await post(TOOLS.DB_SCHEMA_EDIT, { name: 'tasks', op: { op: 'delete' } })
  assert(/deleted/i.test(dropped.data.text), 'db_schema_edit delete ok')
  const after = await post(TOOLS.DB_SCHEMA, {})
  assert(/no collections/i.test(after.data.text), 'all collections gone')
}
