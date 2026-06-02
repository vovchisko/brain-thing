/**
 * schema.update — do-your-best migration of existing rows: drop removed props,
 * add defaults for new ones, coerce across type changes, reset on failure.
 * Migration is lenient (it never rejects existing data on referential grounds);
 * strict referential integrity applies only to the write path (see refs.js).
 *
 * Run standalone: `node src/brain/dataset/test/migration.js`
 */
import path                     from 'node:path'
import fs                       from 'node:fs/promises'
import { Dataset }              from '../database.js'
import { TYPES, FORMATS }       from '../../../shared/dataset/dictionary.js'
import { ok, eq, section, summary, tmpDir, rmDir, createCol, updateCol } from './_utils.js'

async function fresh () {
  const tmp = await tmpDir()
  const db = new Dataset(tmp)
  await db.open()
  return { db, cleanup: async () => { await db.close(); await rmDir(tmp) } }
}

const SIMPLE = {
  label: 'Simple',
  props: [ { key: 'n', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 } ],
}

section('schemas: update migrates existing data')
{
  const { db, cleanup } = await fresh()

  await createCol(db,'migr', {
    label: 'Migr',
    props: [
      { key: 'name',     type: TYPES.STRING,  format: FORMATS.TEXT, def: '' },
      { key: 'gone',     type: TYPES.STRING,  format: FORMATS.TEXT, def: '' },
      { key: 'flag',     type: TYPES.BOOLEAN, format: FORMATS.CHECKBOX, def: false },
      { key: 'priority', type: TYPES.ENUM,    format: FORMATS.SELECT, rules: { options: [ 'low', 'med', 'high' ] }, def: 'med' },
      { key: 'amount',   type: TYPES.STRING,  format: FORMATS.TEXT, def: '' },
    ],
  })
  const col = db.collection('migr')
  const aid = col.create({ name: 'a', gone: 'orphan-1', flag: true,  priority: 'low',  amount: '42'   }).item.id
  const bid = col.create({ name: 'b', gone: 'orphan-2', flag: false, priority: 'high', amount: 'oops' }).item.id

  await updateCol(db,'migr', {
    label: 'Migr',
    props: [
      { key: 'name',     type: TYPES.STRING,  format: FORMATS.TEXT, def: '' },
      { key: 'flag',     type: TYPES.BOOLEAN, format: FORMATS.CHECKBOX, def: false },
      { key: 'priority', type: TYPES.ENUM,    format: FORMATS.SELECT, rules: { options: [ 'low', 'med' ] }, def: 'med' },
      { key: 'amount',   type: TYPES.NUMBER,  format: FORMATS.TEXT, def: 0 },
      { key: 'notes',    type: TYPES.STRING,  format: FORMATS.TEXT, def: 'n/a' },
    ],
  })

  const a = col.get(aid).item
  const b = col.get(bid).item

  ok('dropped field removed (a)', a.gone === undefined)
  ok('dropped field removed (b)', b.gone === undefined)
  eq('added field default (a)', a.notes, 'n/a')
  eq('added field default (b)', b.notes, 'n/a')
  eq('coerced "42" → 42',       a.amount, 42)
  eq('reset "oops" → 0 (def)',  b.amount, 0)
  eq('priority "low" kept',     a.priority, 'low')
  eq('priority "high" reset',   b.priority, 'med')
  eq('kept name (a)',           a.name, 'a')
  eq('kept flag (a)',           a.flag, true)

  await col._flush()
  const persisted = JSON.parse(await fs.readFile(path.join(db._dataDir, 'migr.json'), 'utf8'))
  ok('migration was persisted', persisted[0].notes === 'n/a' && persisted[0].gone === undefined)

  await cleanup()
}

section('schemas: migration — date / array / null / cross-type coercion')
{
  const { db, cleanup } = await fresh()

  // subset target seeded so the initial inserts pass referential integrity
  await createCol(db,'whatever', { props: [ { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' } ] })
  const w = db.collection('whatever')
  const w1 = w.create({ name: 'a' }).item.id
  const w2 = w.create({ name: 'b' }).item.id

  await createCol(db,'m2', {
    label: 'M2',
    props: [
      { key: 'tsStr',   type: TYPES.STRING,  format: FORMATS.TEXT,       def: '' },
      { key: 'flagNum', type: TYPES.NUMBER,  format: FORMATS.TEXT,       def: 0  },
      { key: 'boolStr', type: TYPES.STRING,  format: FORMATS.TEXT,       def: '' },
      { key: 'keepArr', type: TYPES.SUBSET,  rules: { referenceTo: 'whatever' }, def: [] },
      { key: 'nul',     type: TYPES.STRING,  format: FORMATS.TEXT,       def: null },
    ],
  })
  const col = db.collection('m2')

  const aid = col.create({
    tsStr:   '2024-01-15T10:30:00.000Z',
    flagNum: 1,
    boolStr: 'true',
    keepArr: [ w1, w2 ],
    nul:     null,
  }).item.id
  const bid = col.create({
    tsStr:   'not-a-date',
    flagNum: 7,
    boolStr: 'maybe',
    keepArr: [],
    nul:     null,
  }).item.id

  await updateCol(db,'m2', {
    label: 'M2',
    props: [
      { key: 'tsStr',   type: TYPES.DATE,    format: FORMATS.DATEPICKER, def: null },
      { key: 'flagNum', type: TYPES.BOOLEAN, format: FORMATS.CHECKBOX,   def: false },
      { key: 'boolStr', type: TYPES.BOOLEAN, format: FORMATS.CHECKBOX,   def: false },
      { key: 'keepArr', type: TYPES.SUBSET,  rules: { referenceTo: 'whatever' }, def: [] },
      { key: 'nul',     type: TYPES.STRING,  format: FORMATS.TEXT,       def: 'fallback' },
      { key: 'newArr',  type: TYPES.SUBSET,  rules: { referenceTo: 'whatever' }, def: [] },
      { key: 'newDate', type: TYPES.DATE,    format: FORMATS.DATEPICKER, def: null },
    ],
  })

  const a = col.get(aid).item
  const b = col.get(bid).item

  eq('string→date coerce', a.tsStr, '2024-01-15T10:30:00.000Z')
  eq('string→date reset',  b.tsStr, null)
  eq('number(1)→boolean coerce',   a.flagNum, true)
  eq('number(7)→boolean reset',    b.flagNum, false)
  eq('string("true")→bool coerce', a.boolStr, true)
  eq('string("maybe")→bool reset', b.boolStr, false)
  ok('array kept intact',          Array.isArray(a.keepArr) && a.keepArr[0] === w1)
  ok('empty array kept intact',    Array.isArray(b.keepArr) && b.keepArr.length === 0)
  eq('explicit null stays null',   a.nul, null)
  eq('explicit null stays null (b)', b.nul, null)
  ok('added array → []',           Array.isArray(a.newArr) && a.newArr.length === 0)
  eq('added date → null',          a.newDate, null)

  await cleanup()
}

section('schemas: migration — no-op + empty collection')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'n', SIMPLE)
  const col = db.collection('n')

  await updateCol(db,'n', { ...SIMPLE, label: 'NoOp' })
  ok('no-op on empty collection', col.total === 0)

  const nid = col.create({ n: 5 }).item.id
  await updateCol(db,'n', { ...SIMPLE, label: 'NoOp' })
  eq('identical schema preserves value', col.get(nid).item.n, 5)

  await cleanup()
}

summary()
