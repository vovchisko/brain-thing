/**
 * Core Collection + Dataset behavior: create/get/update/delete, id validation,
 * patch semantics, defaults, introspection, persistence roundtrip, events.
 *
 * Run standalone: `node src/brain/dataset/test/crud.js`
 */
import path                     from 'node:path'
import fs                       from 'node:fs/promises'
import { Dataset }              from '../database.js'
import { TYPES, FORMATS, ERR }  from '../../../shared/dataset/dictionary.js'
import { ok, eq, throws, section, summary, tmpDir, rmDir, createCol, updateCol } from './_utils.js'

const ids = (arr) => arr.map(e => e.id)

async function fresh () {
  const tmp = await tmpDir()
  const db = new Dataset(tmp)
  await db.open()
  return { db, tmp, cleanup: async () => { await db.close(); await rmDir(tmp) } }
}

const SIMPLE = {
  label: 'Simple',
  props: [ { key: 'n', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 } ],
}

// -- core CRUD ----------------------------------------------------------------

section('create / get / update / delete')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'test', SIMPLE)
  const col = db.collection('test')

  const a = col.create({ n: 5 })
  const id = a.item.id
  ok('first id is prefixed', id === 'test-1')
  ok('coerced number', a.item.n === 5)

  const got = col.get(id)
  ok('get returns item', got.item.n === 5)
  ok('get returns refs ({})', typeof got.refs === 'object')

  const upd = col.update(id, { n: 99 })
  ok('update returns new value', upd.item.n === 99)
  ok('underlying entity mutated', col.get(id).item.n === 99)

  const del = col.delete(id)
  ok('delete ok=true', del.ok === true)
  await throws('get after delete', () => col.get(id), ERR.NOT_FOUND)
  await throws('update missing', () => col.update(id, { n: 1 }), ERR.NOT_FOUND)
  await throws('delete missing', () => col.delete(id), ERR.NOT_FOUND)
  await cleanup()
}

section('a rejected create does not burn the id (B3)')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', SIMPLE)
  const col = db.collection('t')

  eq('first id is prefixed', col.create({ n: 1 }).item.id, 't-1')
  await throws('invalid create rejected', () => col.create({ n: 'abc' }), ERR.BAD_REQUEST)
  eq('next id stays contiguous after rejection', col.create({ n: 2 }).item.id, 't-2')
  await cleanup()
}

section('item id validation: empty/missing id rejected')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', SIMPLE)
  const col = db.collection('t')
  col.create({ n: 1 })

  await throws('get("") → BAD_REQUEST', () => col.get(''), ERR.BAD_REQUEST)
  await throws('get(null) → BAD_REQUEST', () => col.get(null), ERR.BAD_REQUEST)
  await throws('update("", x) → BAD_REQUEST', () => col.update('', { n: 2 }), ERR.BAD_REQUEST)
  await throws('delete("") → BAD_REQUEST', () => col.delete(''), ERR.BAD_REQUEST)
  await cleanup()
}

section('update: undefined keys are skipped, null overwrites')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', {
    props: [
      { key: 'a', type: TYPES.STRING, format: FORMATS.TEXT, def: 'A' },
      { key: 'b', type: TYPES.STRING, format: FORMATS.TEXT, def: 'B' },
      { key: 'c', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 },
    ],
  })
  const col = db.collection('t')
  const id = col.create({ a: 'one', b: 'two', c: 7 }).item.id

  col.update(id, { b: 'patched', c: undefined })
  const after1 = col.get(id).item
  eq('updated key took effect', after1.b, 'patched')
  eq('undefined key left intact', after1.c, 7)
  eq('absent key left intact', after1.a, 'one')

  col.update(id, { b: null })
  eq('null overwrites previous', col.get(id).item.b, null)

  col.update(id, {})
  eq('empty patch leaves a', col.get(id).item.a, 'one')
  eq('empty patch leaves b', col.get(id).item.b, null)
  eq('empty patch leaves c', col.get(id).item.c, 7)
  await cleanup()
}

section('Collection: size alias, list defaults, empty collection')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', SIMPLE)
  const col = db.collection('t')

  ok('total=0 when empty', col.total === 0)
  ok('size=0 when empty (alias)', col.size === 0)
  const empty = col.list({})
  eq('empty list data', empty.data, [])
  eq('empty list total', empty.total, 0)
  ok('empty list not hasMore', empty.hasMore === false)

  for (let i = 1; i <= 60; i++) col.create({ n: i })
  ok('size alias matches total after inserts', col.size === col.total && col.size === 60)
  const def = col.list({})
  eq('default limit returns 50 rows', def.data.length, 50)
  eq('default limit echoed', def.limit, 50)
  ok('hasMore=true at default limit', def.hasMore === true)
  await cleanup()
}

section('defaults applied on create')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', {
    props: [
      { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: 'untitled' },
      { key: 'count', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 },
      { key: 'tags', type: TYPES.SUBSET, rules: { referenceTo: 't' }, def: [] },
    ],
  })
  const r = db.collection('t').create({})
  eq('default name', r.item.name, 'untitled')
  eq('default count', r.item.count, 0)
  eq('default array', r.item.tags, [])
  await cleanup()
}

section('defaults: each item gets a fresh array/object copy')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', {
    props: [
      { key: 'tags', type: TYPES.SUBSET, rules: { referenceTo: 'tags' }, def: [] },
    ],
  })
  const col = db.collection('t')
  const a = col.create({}).item
  const b = col.create({}).item

  ok('two items get distinct default array refs', a.tags !== b.tags)

  a.tags.push('mutated')
  eq('other item still has empty default', b.tags, [])

  const c = col.create({}).item
  eq('schema def is not polluted (third create still []) ', c.tags, [])

  eq('schema.get(t).props[tags].def stays []',
      db.schemas.get('t').schema.props[0].def, [])

  await cleanup()
}

// -- introspection ------------------------------------------------------------

section('find / findOne / has')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', SIMPLE)
  const col = db.collection('t')
  for (let i = 1; i <= 5; i++) col.create({ n: i })

  ok('has "t-1"', col.has('t-1'))
  ok('has missing → false', col.has('t-99') === false)
  eq('find n>3 ids', ids(col.find(e => e.n > 3)), [ 't-4', 't-5' ])
  ok('findOne first match', col.findOne(e => e.n === 3)?.id === 't-3')
  ok('findOne miss → null', col.findOne(e => e.n > 99) === null)
  await cleanup()
}

// -- persistence --------------------------------------------------------------

section('iterator + changed + persistence')
{
  const { db, tmp, cleanup } = await fresh()
  await createCol(db,'t', SIMPLE)
  const col = db.collection('t')
  ok('iterator starts at 0', col.iterator === 0)
  ok('changed null on empty', col.changed === null)
  col.create({ n: 1 })
  col.create({ n: 2 })
  col.create({ n: 3 })
  ok('iterator=3', col.iterator === 3)
  ok('changed is ISO', typeof col.changed === 'string' && col.changed.endsWith('Z'))

  await db.close()

  const db2 = new Dataset(tmp)
  await db2.open()
  const col2 = db2.collection('t')
  ok('reload size=3', col2.total === 3)
  ok('iterator restored', col2.iterator === 3)
  ok('changed restored', col2.changed?.endsWith('Z') === true)
  ok('next id continues at "4"', col2.create({ n: 4 }).item.id === 't-4')

  await db2.close()
  await rmDir(tmp)
  try { await cleanup() } catch {}
}

// -- Dataset surface ----------------------------------------------------------

section('Dataset: constructor + dataDir + has + collection(missing)')
{
  await throws('new Dataset() without dataDir throws', () => new Dataset(), err => err?.message?.includes('dataDir'))

  const { db, tmp, cleanup } = await fresh()
  eq('dataDir getter', db.dataDir, tmp)
  ok('has() → false on missing', db.has('nope') === false)
  await createCol(db,'present', SIMPLE)
  ok('has() → true after create', db.has('present') === true)
  await throws('collection(missing) → NOT_FOUND', () => db.collection('nope'), ERR.NOT_FOUND)
  await throws('schemas.get(empty) → BAD_REQUEST', () => db.schemas.get(''), ERR.BAD_REQUEST)
  await cleanup()
}

section('Dataset.open: skips invalid schema files + invalid names')
{
  const tmp = await tmpDir()

  await fs.writeFile(path.join(tmp, 'good.schema.json'),
      JSON.stringify({ label: 'Good', idgen: { prefix: 'good' }, props: [ { key: 'n', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 } ] }))
  await fs.writeFile(path.join(tmp, 'Bad Name!.schema.json'), '{}')
  await fs.writeFile(path.join(tmp, 'broken.schema.json'), JSON.stringify({ label: 'Broken' }))
  await fs.writeFile(path.join(tmp, 'corrupt.schema.json'), '{not json')

  const db = new Dataset(tmp)
  await db.open()
  const names = db.schemas.list().map(s => s.name)
  eq('only the valid schema loaded', names, [ 'good' ])
  await db.close()
  await rmDir(tmp)
}

// -- events -------------------------------------------------------------------

section('events: per-collection signals')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', SIMPLE)
  const col = db.collection('t')

  const created = []
  const updated = []
  const deleted = []
  col.when.created(item => created.push(item))
  col.when.updated(item => updated.push(item))
  col.when.deleted(id => deleted.push(id))

  const id = col.create({ n: 1 }).item.id
  col.update(id, { n: 2 })
  col.delete(id)

  eq('created fired once', created.length, 1)
  ok('created carries item snapshot', created[0].n === 1 && created[0].id === id)
  eq('updated fired once', updated.length, 1)
  ok('updated carries patched item', updated[0].n === 2)
  eq('deleted fired once', deleted.length, 1)
  eq('deleted carries id', deleted[0], id)

  await updateCol(db,'t', { ...SIMPLE, label: 'X' })
  eq('schema change does not touch col.when.created', created.length, 1)
  await cleanup()
}

section('events: dataset-level signals')
{
  const { db, cleanup } = await fresh()

  const ic = [], iu = [], id_ = []
  const sc = [], su = [], sd = []
  db.when.itemCreated  (ev => ic.push(ev))
  db.when.itemUpdated  (ev => iu.push(ev))
  db.when.itemDeleted  (ev => id_.push(ev))
  db.when.schemaCreated(ev => sc.push(ev))
  db.when.schemaUpdated(ev => su.push(ev))
  db.when.schemaDeleted(ev => sd.push(ev))

  await createCol(db,'t', SIMPLE)
  const col = db.collection('t')
  const id = col.create({ n: 1 }).item.id
  col.update(id, { n: 2 })
  col.delete(id)
  await updateCol(db,'t', { ...SIMPLE, label: 'X' })
  await db.schemas.delete('t')

  eq('itemCreated fired',         ic.length, 1)
  eq('itemCreated.collection',    ic[0].collection, 't')
  ok('itemCreated.item.n',        ic[0].item?.n === 1)
  eq('itemUpdated fired',         iu.length, 1)
  ok('itemUpdated.item is patched', iu[0].item?.n === 2)
  eq('itemDeleted fired',         id_.length, 1)
  eq('itemDeleted.id',            id_[0].id, id)
  ok('itemDeleted has no item',   id_[0].item === undefined)

  eq('schemaCreated fired', sc.length, 1)
  ok('schemaCreated.schema present', sc[0].schema?.props?.length === 1)
  eq('schemaUpdated fired', su.length, 1)
  ok('schemaUpdated.schema reflects change', su[0].schema?.label === 'X')
  eq('schemaDeleted fired', sd.length, 1)
  eq('schemaDeleted.name', sd[0].name, 't')
  ok('schemaDeleted carries no schema', sd[0].schema === undefined)

  ok('no kind on item signal', ic[0].kind === undefined)
  ok('no kind on schema signal', sc[0].kind === undefined)
  await cleanup()
}

// -- bulk ops -----------------------------------------------------------------

section('createMany: all-or-nothing bulk insert')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', SIMPLE)
  const col = db.collection('t')

  const res = col.createMany([ { n: 1 }, { n: 2 }, { n: 3 } ])
  eq('returns created items', res.items.map(i => i.n), [ 1, 2, 3 ])
  eq('ids sequential', res.items.map(i => i.id), [ 't-1', 't-2', 't-3' ])
  eq('all persisted', col.total, 3)

  await throws('a bad row rolls back the whole batch',
      () => col.createMany([ { n: 9 }, { n: 'oops' } ]), ERR.BAD_REQUEST)
  eq('nothing inserted from the failed batch', col.total, 3)
  await throws('error locates the bad row',
      () => col.createMany([ { n: 'x' } ]), err => /rows\[0\]/.test(err.text))
  await throws('empty batch rejected', () => col.createMany([]), ERR.BAD_REQUEST)

  await cleanup()
}

section('deleteMany: all-or-nothing, force clears refs')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'g', { props: [ { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' } ] })
  await createCol(db,'b', { props: [
    { key: 'title', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
    { key: 'g', type: TYPES.REFERENCE, rules: { referenceTo: 'g' }, def: null },
  ] })
  const g = db.collection('g')
  const b = db.collection('b')
  const gs = g.createMany([ { name: 'a' }, { name: 'b' }, { name: 'c' } ]).items
  const bid = b.create({ title: 'x', g: gs[0].id }).item.id

  await throws('a missing id rejects the batch', () => g.deleteMany([ gs[1].id, '999' ]), ERR.NOT_FOUND)
  eq('nothing deleted on a bad batch', g.total, 3)

  const r = g.deleteMany([ gs[1].id, gs[2].id ])
  eq('two deleted', r.deleted.length, 2)
  eq('collection down to 1', g.total, 1)

  await throws('a referenced id blocks the batch', () => g.deleteMany([ gs[0].id ]), ERR.CONFLICT)
  const f = g.deleteMany([ gs[0].id ], { force: true })
  eq('forced delete cleared the ref', b.get(bid).item.g, null)
  ok('cleared reported', f.cleared.length >= 1)
  eq('collection now empty', g.total, 0)

  await cleanup()
}

summary()
