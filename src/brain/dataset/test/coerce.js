/**
 * Value coercion + validation on insert: per-type rules, error messages, and
 * array-element typing. Subset fields reference a seeded "tags" collection so
 * the strict referential check (see refs.js) is satisfied with real ids.
 *
 * Run standalone: `node src/brain/dataset/test/coerce.js`
 */
import { Dataset }              from '../database.js'
import { TYPES, FORMATS, ERR }  from '../../../shared/dataset/dictionary.js'
import { ok, eq, throws, section, summary, tmpDir, rmDir, createCol } from './_utils.js'

const ids = (arr) => arr.map(e => e.id)

async function fresh () {
  const tmp = await tmpDir()
  const db = new Dataset(tmp)
  await db.open()
  return { db, cleanup: async () => { await db.close(); await rmDir(tmp) } }
}

const TAGS = { props: [ { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' } ] }

section('coercion / validation')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'tags', TAGS)
  const t1 = db.collection('tags').create({ name: 'one' }).item
  await createCol(db,'t', {
    props: [
      { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
      { key: 'count', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 },
      { key: 'flag', type: TYPES.BOOLEAN, format: FORMATS.CHECKBOX, def: false },
      { key: 'when', type: TYPES.DATE, format: FORMATS.DATEPICKER, def: null },
      { key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT, rules: { options: [ 'a', 'b' ] }, def: 'a' },
      { key: 'list', type: TYPES.SUBSET, rules: { referenceTo: 'tags' }, def: [] },
    ],
  })
  const col = db.collection('t')
  const r = col.create({ name: 42, count: '7', flag: 1, when: '2024-03-15', kind: 'b', list: [ t1.id ] })
  eq('string ← number', r.item.name, '42')
  eq('number ← numeric string', r.item.count, 7)
  eq('boolean ← 1', r.item.flag, true)
  ok('date → ISO string', r.item.when.endsWith('Z'))
  eq('enum kept', r.item.kind, 'b')
  eq('array kept', r.item.list, [ t1.id ])

  eq('string ← boolean', col.create({ name: true }).item.name, 'true')
  await throws('string ← object rejected', () => col.create({ name: { a: 1 } }), ERR.BAD_REQUEST)
  await throws('string ← array rejected', () => col.create({ name: [ 1, 2 ] }), ERR.BAD_REQUEST)

  await throws('number ← "abc" rejected', () => col.create({ count: 'abc' }), ERR.BAD_REQUEST)
  eq('number ← "" uses default (P4: empty = no value)', col.create({ count: '' }).item.count, 0)
  await throws('number ← boolean rejected', () => col.create({ count: true }), ERR.BAD_REQUEST)
  await throws('number ← NaN rejected', () => col.create({ count: NaN }), ERR.BAD_REQUEST)

  eq('boolean ← "true"',  col.create({ flag: 'true' }).item.flag, true)
  eq('boolean ← "false"', col.create({ flag: 'false' }).item.flag, false)
  eq('boolean ← "0"',     col.create({ flag: '0' }).item.flag, false)
  eq('boolean ← 0',       col.create({ flag: 0 }).item.flag, false)
  await throws('boolean ← "banana" rejected', () => col.create({ flag: 'banana' }), ERR.BAD_REQUEST)
  await throws('boolean ← 5 rejected', () => col.create({ flag: 5 }), ERR.BAD_REQUEST)

  await throws('bad date rejected', () => col.create({ when: 'not a date' }), ERR.BAD_REQUEST)
  eq('date ← epoch ms', typeof col.create({ when: 1700000000000 }).item.when, 'string')
  await throws('bad enum rejected', () => col.create({ kind: 'wrong' }), ERR.BAD_REQUEST)
  await throws('non-array → array rejected', () => col.create({ list: 'x' }), ERR.BAD_REQUEST)

  await throws('error carries a human message', () => col.create({ count: 'abc' }),
      err => err?.text?.includes('Field "count"') && err.text.includes('number'))
  await cleanup()
}

section('array elements: stored as strings, has/hasAny stay consistent')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'tags', TAGS)
  const tags = db.collection('tags')
  const red   = tags.create({ name: 'red' }).item
  const sweet = tags.create({ name: 'sweet' }).item

  await createCol(db,'t', {
    props: [
      { key: 'tags', type: TYPES.SUBSET, rules: { referenceTo: 'tags' }, def: [] },
    ],
  })
  const col = db.collection('t')

  // element typing is checked before referential integrity — non-string fails at coercion
  await throws('array with numeric elements rejected on insert',
      () => col.create({ tags: [ 1, 2, 3 ] }), ERR.BAD_REQUEST)
  await throws('array with mixed-type elements rejected on insert',
      () => col.create({ tags: [ red.id, 2 ] }), ERR.BAD_REQUEST)
  await throws('array with boolean element rejected',
      () => col.create({ tags: [ true ] }), ERR.BAD_REQUEST)
  await throws('array with object element rejected',
      () => col.create({ tags: [ { a: 1 } ] }), ERR.BAD_REQUEST)

  const a = col.create({ tags: [ red.id, sweet.id ] }).item
  eq('string-only array accepted', a.tags, [ red.id, sweet.id ])

  const b = col.create({ tags: [ red.id, null ] }).item
  eq('null array element preserved', b.tags, [ red.id, null ])

  eq('has matches string element',
      ids(col.list({ filters: [ { key: 'tags', op: 'has', value: red.id } ] }).data),
      [ a.id, b.id ])

  eq('hasAny matches any in list',
      ids(col.list({ filters: [ { key: 'tags', op: 'hasAny', value: [ sweet.id, 'nope' ] } ] }).data),
      [ a.id ])

  await cleanup()
}

section('array fields are always an array, never null')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'tags', TAGS)
  const t1 = db.collection('tags').create({ name: 'one' }).item
  await createCol(db,'t', {
    props: [ { key: 'list', type: TYPES.SUBSET, rules: { referenceTo: 'tags' }, def: [] } ],
  })
  const col = db.collection('t')

  eq('omitted → []', col.create({}).item.list, [])
  eq('null on create → []', col.create({ list: null }).item.list, [])

  const r = col.create({ list: [ t1.id ] }).item
  col.update(r.id, { list: null })
  eq('cleared to [] on update, not null', col.get(r.id).item.list, [])
  col.update(r.id, { list: [ t1.id ] })
  col.update(r.id, { list: '' })
  eq('empty-string clear → [] too', col.get(r.id).item.list, [])

  await cleanup()
}

summary()
