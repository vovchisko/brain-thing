/**
 * Id generation (Storage B): mandatory explicit prefix, "<prefix>-<counter>"
 * encoding, prefix validation + cross-collection uniqueness, and the set_idgen
 * cascade that re-prefixes every id and every inbound reference.
 *
 * Run standalone: `node src/brain/dataset/test/idgen.js`
 */
import { Dataset }              from '../database.js'
import { TYPES, FORMATS, ERR }  from '../../../shared/dataset/dictionary.js'
import { ids }                  from '../../../shared/dataset/ids.js'
import { ok, eq, throws, section, summary, tmpDir, rmDir, createCol } from './_utils.js'

async function fresh () {
  const tmp = await tmpDir()
  const db = new Dataset(tmp)
  await db.open()
  return { db, tmp, cleanup: async () => { await db.close(); await rmDir(tmp) } }
}

const S = { props: [ { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' } ] }

// -- encode/decode primitives -------------------------------------------------

section('ids.encode/decode: counter is the trailing digit run')
{
  eq('encode joins with "-"', ids.encode('TASK', 7), 'TASK-7')
  eq('decode splits prefix/counter', ids.decode('TASK-7'), { prefix: 'TASK', counter: 7 })
  eq('decode is greedy on the prefix', ids.decode('A-B-12'), { prefix: 'A-B', counter: 12 })
  eq('decode of a non-id is null', ids.decode('nope'), null)
  ok('valid prefix: letters', ids.isValidPrefix('TASK'))
  ok('valid prefix: digit after first char', ids.isValidPrefix('m2'))
  ok('invalid prefix: leading digit', !ids.isValidPrefix('2m'))
  ok('invalid prefix: has space', !ids.isValidPrefix('a b'))
  ok('invalid prefix: empty', !ids.isValidPrefix(''))
}

// -- schema requires a valid, unique prefix -----------------------------------

section('schema: idgen.prefix is mandatory, validated, unique')
{
  const { db, cleanup } = await fresh()

  await throws('create without idgen → BAD_REQUEST',
      () => db.schemas.create('a', S), ERR.BAD_REQUEST)
  await throws('create with leading-digit prefix → BAD_REQUEST',
      () => db.schemas.create('a', { ...S, idgen: { prefix: '2bad' } }), ERR.BAD_REQUEST)
  await throws('create with spaced prefix → BAD_REQUEST',
      () => db.schemas.create('a', { ...S, idgen: { prefix: 'a b' } }), ERR.BAD_REQUEST)

  await db.schemas.create('a', { ...S, idgen: { prefix: 'A' } })
  ok('valid prefix accepted', db.schemas.get('a').schema.idgen.prefix === 'A')

  await throws('duplicate prefix across collections → CONFLICT',
      () => db.schemas.create('b', { ...S, idgen: { prefix: 'A' } }), ERR.CONFLICT)
  await db.schemas.create('b', { ...S, idgen: { prefix: 'B' } })
  ok('distinct prefix accepted', db.schemas.get('b').schema.idgen.prefix === 'B')

  await cleanup()
}

// -- ids carry the prefix -----------------------------------------------------

section('rows: ids are "<prefix>-<counter>", counter monotonic')
{
  const { db, cleanup } = await fresh()
  await db.schemas.create('t', { ...S, idgen: { prefix: 'TASK' } })
  const col = db.collection('t')
  eq('first id', col.create({ name: 'a' }).item.id, 'TASK-1')
  eq('second id', col.create({ name: 'b' }).item.id, 'TASK-2')
  await cleanup()
}

// -- set_idgen cascade --------------------------------------------------------

section('set_idgen: re-prefixes every id and every inbound reference')
{
  const { db, cleanup } = await fresh()
  await createCol(db, 'authors', S)                                   // prefix "authors"
  await createCol(db, 'books', {
    props: [
      { key: 'title',  type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
      { key: 'author', type: TYPES.REFERENCE, rules: { referenceTo: 'authors' }, def: null },
      { key: 'co',     type: TYPES.SUBSET, rules: { referenceTo: 'authors' }, def: [] },
    ],
  })
  const authors = db.collection('authors')
  const books   = db.collection('books')
  const a1 = authors.create({ name: 'Orwell' }).item.id   // authors-1
  const a2 = authors.create({ name: 'Huxley' }).item.id   // authors-2
  const b  = books.create({ title: '1984', author: a1, co: [ a1, a2 ] }).item.id

  await db.schemas.setIdgen('authors', 'AUT')

  eq('row ids re-prefixed', authors.list({}).data.map(r => r.id), [ 'AUT-1', 'AUT-2' ])
  ok('old id no longer resolves', !authors.has('authors-1'))
  ok('new id resolves', authors.has('AUT-1'))

  const book = books.get(b).item
  eq('single inbound ref rewritten', book.author, 'AUT-1')
  eq('subset inbound refs rewritten', book.co, [ 'AUT-1', 'AUT-2' ])
  eq('schema prefix updated', db.schemas.get('authors').schema.idgen.prefix, 'AUT')

  // and the counter keeps going from where it was
  eq('next id uses the new prefix + preserved counter', authors.create({ name: 'X' }).item.id, 'AUT-3')

  await throws('re-prefix to a taken prefix → CONFLICT',
      () => db.schemas.setIdgen('authors', 'books'), ERR.CONFLICT)

  await cleanup()
}

// -- set_idgen survives a reload ----------------------------------------------

section('set_idgen: re-prefixed ids + refs persist across reload')
{
  const { db, tmp, cleanup } = await fresh()
  await createCol(db, 'authors', S)
  await createCol(db, 'books', {
    props: [ { key: 'author', type: TYPES.REFERENCE, rules: { referenceTo: 'authors' }, def: null } ],
  })
  const a = db.collection('authors').create({ name: 'Orwell' }).item.id
  db.collection('books').create({ author: a })
  await db.schemas.setIdgen('authors', 'AUT')
  await db.close()

  const db2 = new Dataset(tmp)
  await db2.open()
  ok('id persisted re-prefixed', db2.collection('authors').has('AUT-1'))
  eq('inbound ref persisted re-prefixed', db2.collection('books').list({}).data[0].author, 'AUT-1')
  await db2.close()
  await rmDir(tmp)
  try { await cleanup() } catch {}
}

summary()
