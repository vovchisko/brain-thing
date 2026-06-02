/**
 * Referential integrity + reference/subset output.
 *
 * Contract: reference (single) and subset (array) fields store ONLY ids of rows
 * that exist in the target collection. Input is strict — a missing target
 * collection or an unknown id is rejected on create/update (BAD_REQUEST). The
 * read-side `refs` map stays lenient so a reference orphaned by a *later* delete
 * still renders gracefully.
 *
 * Run standalone: `node src/brain/dataset/test/refs.js`
 */
import { Dataset }              from '../database.js'
import { filters }              from '../../../shared/dataset/filters.js'
import { TYPES, FORMATS, ERR }  from '../../../shared/dataset/dictionary.js'
import { ok, eq, throws, section, summary, tmpDir, rmDir, createCol } from './_utils.js'

async function fresh () {
  const tmp = await tmpDir()
  const db = new Dataset(tmp)
  await db.open()
  return { db, cleanup: async () => { await db.close(); await rmDir(tmp) } }
}

const TAGS = { props: [ { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' } ] }

const BOOKS = {
  label: 'Books',
  props: [
    { key: 'title',  type: TYPES.STRING, format: FORMATS.TEXT,      def: '' },
    { key: 'author', type: TYPES.REFERENCE, rules: { referenceTo: 'authors' }, def: null },
    { key: 'tags',   type: TYPES.SUBSET,    rules: { referenceTo: 'tags' },    def: [] },
  ],
}

async function seeded () {
  const { db, cleanup } = await fresh()
  await createCol(db,'authors', TAGS)
  await createCol(db,'tags', TAGS)
  await createCol(db,'books', BOOKS)
  const authors = db.collection('authors')
  const tags    = db.collection('tags')
  const orwell  = authors.create({ name: 'George Orwell' }).item
  const dyst    = tags.create({ name: 'Dystopia' }).item
  const classic = tags.create({ name: 'Classic' }).item
  return { db, cleanup, books: db.collection('books'), ids: { orwell: orwell.id, dyst: dyst.id, classic: classic.id } }
}

// -- strict input: create -----------------------------------------------------

section('refs: create requires existing ids')
{
  const { books, ids, cleanup } = await seeded()

  const r = books.create({ title: '1984', author: ids.orwell, tags: [ ids.dyst, ids.classic ] }).item
  eq('valid reference stored as id', r.author, ids.orwell)
  eq('valid subset stored as ids',   r.tags, [ ids.dyst, ids.classic ])

  await throws('reference to unknown id rejected',
      () => books.create({ title: 'X', author: '999' }), ERR.BAD_REQUEST)
  await throws('reference to a label (not an id) rejected',
      () => books.create({ title: 'X', author: 'George Orwell' }), ERR.BAD_REQUEST)
  await throws('subset with one unknown id rejected',
      () => books.create({ title: 'X', tags: [ ids.dyst, 'nope' ] }), ERR.BAD_REQUEST)
  await throws('reference error names the field + points at db_query',
      () => books.create({ title: 'X', author: '999' }),
      err => err?.text?.includes('"author"') && err.text.includes('db_query'))

  await cleanup()
}

section('refs: reference to a non-existent collection is rejected')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'a', {
    props: [
      { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
      { key: 'ghostRef', type: TYPES.REFERENCE, rules: { referenceTo: 'ghost' }, def: null },
    ],
  })
  await throws('ref into a missing collection rejected',
      () => db.collection('a').create({ name: 'first', ghostRef: '1' }), ERR.BAD_REQUEST)
  // null/empty refs never trigger validation — the collection may not exist yet
  const r = db.collection('a').create({ name: 'first' }).item
  eq('null reference accepted', r.ghostRef, null)
  await cleanup()
}

section('refs: null reference + empty subset accepted')
{
  const { books, cleanup } = await seeded()
  const r = books.create({ title: 'bare' }).item
  eq('default null reference', r.author, null)
  eq('default empty subset', r.tags, [])
  await cleanup()
}

// -- strict input: update -----------------------------------------------------

section('refs: update validates and does not partially mutate')
{
  const { books, ids, cleanup } = await seeded()
  const b = books.create({ title: '1984', author: ids.orwell, tags: [ ids.dyst ] }).item

  books.update(b.id, { author: null, tags: [ ids.dyst, ids.classic ] })
  const ok1 = books.get(b.id).item
  eq('valid update cleared author', ok1.author, null)
  eq('valid update extended tags',  ok1.tags, [ ids.dyst, ids.classic ])

  await throws('update to unknown reference rejected',
      () => books.update(b.id, { author: 'no-id' }), ERR.BAD_REQUEST)
  await throws('update subset with unknown id rejected',
      () => books.update(b.id, { tags: [ 'bad' ] }), ERR.BAD_REQUEST)

  const after = books.get(b.id).item
  eq('failed update left tags intact', after.tags, [ ids.dyst, ids.classic ])
  eq('failed update left author intact', after.author, null)
  await cleanup()
}

// -- self-reference (no self-loop) --------------------------------------------

section('refs: a row may not reference its own id')
{
  const { db, cleanup } = await fresh()
  await createCol(db, 'nodes', {
    props: [
      { key: 'name',   type: TYPES.STRING,    format: FORMATS.TEXT,             def: '' },
      { key: 'parent', type: TYPES.REFERENCE, rules: { referenceTo: 'nodes' },  def: null },
      { key: 'links',  type: TYPES.SUBSET,    rules: { referenceTo: 'nodes' },  def: [] },
    ],
  })
  const nodes = db.collection('nodes')
  const a = nodes.create({ name: 'A' }).item
  const b = nodes.create({ name: 'B' }).item

  // pointing at ANOTHER row in the same collection is the whole point — allowed
  nodes.update(a.id, { parent: b.id, links: [ b.id ] })
  eq('same-collection ref to another row works', nodes.get(a.id).item.parent, b.id)
  eq('same-collection subset to another row works', nodes.get(a.id).item.links, [ b.id ])

  // pointing at the row's OWN id is rejected — single reference and inside a subset
  await throws('reference to own id rejected',
      () => nodes.update(a.id, { parent: a.id }), ERR.BAD_REQUEST)
  await throws('subset containing own id rejected',
      () => nodes.update(a.id, { links: [ b.id, a.id ] }), ERR.BAD_REQUEST)
  await throws('self-ref error names the own id and says "itself"',
      () => nodes.update(a.id, { parent: a.id }),
      err => err?.text?.includes(a.id) && /itself|own/i.test(err.text))

  // a rejected self-ref leaves the row intact
  eq('row untouched after rejected self-ref', nodes.get(a.id).item.parent, b.id)
  eq('subset untouched after rejected self-ref', nodes.get(a.id).item.links, [ b.id ])

  await cleanup()
}

// -- read-side refs map -------------------------------------------------------

section('refs: list/get response carries id→label buckets')
{
  const { db, books, ids, cleanup } = await seeded()
  const bookId = books.create({ title: '1984', author: ids.orwell, tags: [ ids.dyst, ids.classic ] }).item.id

  const res = books.list({})
  ok('refs.authors present', Array.isArray(res.refs.authors))
  ok('refs.tags present', Array.isArray(res.refs.tags))
  const aLabels = Object.fromEntries(res.refs.authors.map(r => [ r.id, r.label ]))
  const tLabels = Object.fromEntries(res.refs.tags.map(r => [ r.id, r.label ]))
  eq('author label resolved', aLabels[ids.orwell], 'George Orwell')
  eq('tag label resolved', tLabels[ids.dyst], 'Dystopia')

  const got = books.get(bookId)
  ok('get carries refs too', Array.isArray(got.refs.authors))
  await cleanup()
}

section('refs: delete is blocked while referenced, force cascades-null (B10)')
{
  const { db, books, ids, cleanup } = await seeded()
  const authors = db.collection('authors')
  const tags    = db.collection('tags')
  const b = books.create({ title: '1984', author: ids.orwell, tags: [ ids.dyst, ids.classic ] }).item

  // an unreferenced row deletes freely
  const lone = authors.create({ name: 'Nobody' }).item
  ok('unreferenced row deletes without force', authors.delete(lone.id).ok === true)

  // a referenced row is blocked without force and stays put
  await throws('delete blocked while referenced',
      () => authors.delete(ids.orwell), ERR.CONFLICT)
  ok('blocked delete kept the row', authors.has(ids.orwell))
  eq('blocked delete left the reference intact', books.get(b.id).item.author, ids.orwell)
  await throws('block error names the referencing field',
      () => authors.delete(ids.orwell), err => err?.text?.includes('books.author'))

  // force: deletes the row and NULLs the single reference; the book survives
  const res = authors.delete(ids.orwell, { force: true })
  ok('force removed the author', authors.has(ids.orwell) === false)
  ok('book survived', books.has(b.id))
  eq('single reference cleared to null', books.get(b.id).item.author, null)
  eq('force reports the cleared reference', res.cleared.length, 1)

  // force on a subset target drops the id from the array, keeps the rest
  const resT = tags.delete(ids.dyst, { force: true })
  eq('subset id removed, others kept', books.get(b.id).item.tags, [ ids.classic ])
  eq('subset clear reported', resT.cleared.length, 1)

  // read-side stays lenient — a list never surfaces a now-missing id as a label
  const list = books.list({})
  ok('no dangling author label', !list.refs.authors || !list.refs.authors.some(r => r.id === ids.orwell))

  await cleanup()
}

section('refs: collection delete is blocked while referenced, force clears referrers (B10)')
{
  const { db, books, ids, cleanup } = await seeded()
  books.create({ title: '1984', author: ids.orwell, tags: [ ids.dyst ] })

  await throws('drop blocked while referenced',
      () => db.schemas.delete('authors'), ERR.CONFLICT)
  ok('authors collection still there', db.has('authors'))
  await throws('block error names the referrer',
      () => db.schemas.delete('authors'), err => err?.text?.includes('books.author'))

  const res = await db.schemas.delete('authors', { force: true })
  ok('authors collection gone', db.has('authors') === false)
  eq('referencing field cleared to null', db.collection('books').list({}).data[0].author, null)
  ok('cleared reported', res.cleared.length >= 1)
  // an unrelated subset ref to a still-present collection is untouched
  eq('other reference intact', db.collection('books').list({}).data[0].tags, [ ids.dyst ])

  await cleanup()
}

// -- schema-write paths must honour referential integrity too -----------------
// (add_field default-fill + update_field re-coerce wrote ref values straight past
//  validateRefs, fabricating dangling references the row API swears are impossible.)

section('refs: schema writes cannot fabricate dangling references')
{
  // Vector 1 — add_field with a reference default that is not a real id: rejected, like a row write.
  {
    const { db, cleanup } = await seeded()
    db.collection('books').create({ title: '1984' })
    await throws('add_field ref def of a non-existent id rejected',
        () => db.schemas.addField('books', { key: 'lead', type: TYPES.REFERENCE, rules: { referenceTo: 'authors' }, def: 'NOPE-1' }),
        ERR.BAD_REQUEST)
    ok('the field was not added', !db.schemas.get('books').schema.props.some(p => p.key === 'lead'))
    await cleanup()
  }

  // add_field with a VALID reference default is accepted and fills existing rows with the real id.
  {
    const { db, cleanup, ids } = await seeded()
    db.collection('books').create({ title: '1984' })
    await db.schemas.addField('books', { key: 'lead', type: TYPES.REFERENCE, rules: { referenceTo: 'authors' }, def: ids.orwell })
    eq('valid ref default applied to existing rows', db.collection('books').list({}).data[0].lead, ids.orwell)
    await cleanup()
  }

  // Vector 2 — retype a string column holding garbage to a reference: garbage is cleared, not kept.
  {
    const { db, cleanup } = await seeded()
    const books = db.collection('books')
    await db.schemas.addField('books', { key: 'note', type: TYPES.STRING, format: FORMATS.TEXT, def: '' })
    const row = books.create({ title: '1984', note: 'GARBAGE-42' }).item
    const res = await db.schemas.updateField('books', 'note', { type: TYPES.REFERENCE, rules: { referenceTo: 'authors' }, def: null })
    eq('field is now a reference', db.schemas.get('books').schema.props.find(p => p.key === 'note').type, TYPES.REFERENCE)
    eq('dangling string value cleared to null', books.get(row.id).item.note, null)
    ok('the clearing was surfaced, not silent', Array.isArray(res.notes) && res.notes.some(n => /real row|cleared/i.test(n)))
    await cleanup()
  }

  // Subset retype — invalid ids are dropped, valid ids survive.
  {
    const { db, cleanup, ids } = await seeded()
    const books = db.collection('books')
    await db.schemas.addField('books', { key: 'crew', type: TYPES.ARRAY, def: [] })
    const row = books.create({ title: '1984', crew: [ ids.orwell, 'GHOST-9' ] }).item
    await db.schemas.updateField('books', 'crew', { type: TYPES.SUBSET, rules: { referenceTo: 'authors' }, def: [] })
    eq('valid id kept, ghost dropped', books.get(row.id).item.crew, [ ids.orwell ])
    await cleanup()
  }
}

// -- pure helpers -------------------------------------------------------------

section('filters singleton: displayLabel / displayPropKey')
{
  ok('frozen', Object.isFrozen(filters))
  eq('displayPropKey: explicit', filters.displayPropKey({ displayProp: 'foo', props: [] }), 'foo')
  eq('displayPropKey: first string', filters.displayPropKey({ props: [ { key: 'n', type: TYPES.NUMBER }, { key: 's', type: TYPES.STRING } ] }), 's')
  eq('displayPropKey: fallback to id', filters.displayPropKey({ props: [ { key: 'n', type: TYPES.NUMBER } ] }), 'id')
  eq('displayLabel: takes displayProp', filters.displayLabel({ id: '1', name: 'X' }, { displayProp: 'name', props: [] }), 'X')
  eq('displayLabel: fallback to id', filters.displayLabel({ id: '1' }, { props: [] }), '1')
}

summary()
