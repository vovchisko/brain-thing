/**
 * Unit tests for schema validation rules.
 * Run standalone: `node src/brain/dataset/test/schemas.js`
 */
import fs                       from 'node:fs/promises'
import path                     from 'node:path'
import { Dataset }              from '../database.js'
import { TYPES, FORMATS, ERR }  from '../../../shared/dataset/dictionary.js'
import { ok, eq, throws, section, summary, tmpDir, rmDir, createCol, updateCol } from './_utils.js'

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

// ----- enum default in options ------------------------------------------------

section('assertValidSchema: enum default must be in options')
{
  const { db, cleanup } = await fresh()

  await throws('enum def="" with options=[low,med] → BAD_REQUEST',
      () => createCol(db,'e1', {
        props: [ {
          key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT,
          rules: { options: [ 'low', 'med' ] }, def: '',
        } ],
      }), ERR.BAD_REQUEST)

  await throws('enum def="ghost" not in options → BAD_REQUEST',
      () => createCol(db,'e2', {
        props: [ {
          key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT,
          rules: { options: [ 'low', 'med' ] }, def: 'ghost',
        } ],
      }), ERR.BAD_REQUEST)

  await throws('enum def matching .label (not .value) → BAD_REQUEST',
      () => createCol(db,'e3', {
        props: [ {
          key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT,
          rules: { options: [ { value: 'low', label: 'Low' } ] }, def: 'Low',
        } ],
      }), ERR.BAD_REQUEST)

  await createCol(db,'e_ok_str', {
    props: [ {
      key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT,
      rules: { options: [ 'low', 'med' ] }, def: 'low',
    } ],
  })
  ok('valid string-form def accepted', db.schemas.get('e_ok_str').name === 'e_ok_str')

  await createCol(db,'e_ok_obj', {
    props: [ {
      key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT,
      rules: { options: [ { value: 'low', label: 'Low' }, { value: 'med', label: 'Med' } ] },
      def: 'low',
    } ],
  })
  ok('valid object-form def accepted', db.schemas.get('e_ok_obj').name === 'e_ok_obj')

  await createCol(db,'e_ok_null', {
    props: [ {
      key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT,
      rules: { options: [ 'low', 'med' ] }, def: null,
    } ],
  })
  ok('null def accepted (means "no value")', db.schemas.get('e_ok_null').name === 'e_ok_null')

  await cleanup()
}

// ----- enum default validation on schema.update -------------------------------

section('assertValidSchema: enum default rule also enforced on schema.update')
{
  const { db, cleanup } = await fresh()

  await createCol(db,'e', {
    props: [ {
      key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT,
      rules: { options: [ 'low', 'med' ] }, def: 'low',
    } ],
  })

  await throws('update to enum def="x" not in options → BAD_REQUEST',
      () => updateCol(db,'e', {
        props: [ {
          key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT,
          rules: { options: [ 'low', 'med' ] }, def: 'x',
        } ],
      }), ERR.BAD_REQUEST)

  await cleanup()
}

// ----- Schemas.update durability ---------------------------------------------

section('Schemas.update flushes migrated data to disk before returning')
{
  const { db, tmp, cleanup } = await fresh()

  await createCol(db,'t', {
    props: [
      { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
      { key: 'gone', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
    ],
  })
  const col = db.collection('t')
  col.create({ name: 'a', gone: 'orphan' })
  await col._flush()

  await updateCol(db,'t', {
    props: [
      { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
    ],
  })

  const persisted = JSON.parse(await fs.readFile(path.join(tmp, 't.json'), 'utf8'))
  ok('data file reflects migration immediately', persisted[0].gone === undefined,
      `persisted[0]=${ JSON.stringify(persisted[0]) }`)

  const schemaOnDisk = JSON.parse(await fs.readFile(path.join(tmp, 't.schema.json'), 'utf8'))
  ok('schema file has new shape', schemaOnDisk.props.length === 1)

  await cleanup()
}

// ----- _loadOne: no preemptive empty data file --------------------------------

section('schemas.create does not write empty data file pre-emptively')
{
  const { db, tmp, cleanup } = await fresh()
  await createCol(db,'lazy', {
    props: [ { key: 'n', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 } ],
  })

  await throws('data file is absent until first insert',
      () => fs.access(path.join(tmp, 'lazy.json')),
      err => err?.code === 'ENOENT')

  await fs.access(path.join(tmp, 'lazy.schema.json'))

  db.collection('lazy').create({ n: 1 })
  await db.collection('lazy')._flush()
  await fs.access(path.join(tmp, 'lazy.json'))

  await cleanup()
}

// ----- type-mismatched defaults ----------------------------------------------

section('assertValidSchema: rejects type-mismatched def for every type')
{
  const { db, cleanup } = await fresh()

  const badDefs = [
    [ 'string_obj',   { type: TYPES.STRING,  format: FORMATS.TEXT,       def: { a: 1 } } ],
    [ 'string_arr',   { type: TYPES.STRING,  format: FORMATS.TEXT,       def: [ 'x' ] } ],
    [ 'number_oops',  { type: TYPES.NUMBER,  format: FORMATS.TEXT,       def: 'oops' } ],
    [ 'number_nan',   { type: TYPES.NUMBER,  format: FORMATS.TEXT,       def: NaN } ],
    [ 'number_obj',   { type: TYPES.NUMBER,  format: FORMATS.TEXT,       def: {} } ],
    [ 'boolean_5',    { type: TYPES.BOOLEAN, format: FORMATS.CHECKBOX,   def: 5 } ],
    [ 'boolean_yes',  { type: TYPES.BOOLEAN, format: FORMATS.CHECKBOX,   def: 'yes' } ],
    [ 'date_garbage', { type: TYPES.DATE,    format: FORMATS.DATEPICKER, def: 'yesterday' } ],
    [ 'date_bool',    { type: TYPES.DATE,    format: FORMATS.DATEPICKER, def: true } ],
    [ 'array_no',     { type: TYPES.SUBSET,
                        rules: { referenceTo: 'tags' }, def: 'no' } ],
    [ 'array_obj',    { type: TYPES.SUBSET,
                        rules: { referenceTo: 'tags' }, def: { length: 0 } } ],
  ]

  for (const [ label, prop ] of badDefs) {
    await throws(`def rejected: ${ label }`,
        () => createCol(db,'bad_' + label, { props: [ { key: 'x', ...prop } ] }),
        ERR.BAD_REQUEST)
  }

  await createCol(db,'ok_all', {
    props: [
      { key: 's', type: TYPES.STRING,  format: FORMATS.TEXT,       def: 'hello' },
      { key: 'n', type: TYPES.NUMBER,  format: FORMATS.TEXT,       def: 0 },
      { key: 'b', type: TYPES.BOOLEAN, format: FORMATS.CHECKBOX,   def: false },
      { key: 'd', type: TYPES.DATE,    format: FORMATS.DATEPICKER, def: null },
      { key: 'a', type: TYPES.SUBSET,
        rules: { referenceTo: 'tags' }, def: [] },
    ],
  })
  ok('valid defs across all types accepted', db.schemas.get('ok_all').name === 'ok_all')

  await createCol(db,'ok_date_iso', {
    props: [ {
      key: 'when', type: TYPES.DATE, format: FORMATS.DATEPICKER,
      def: '2026-05-26T00:00:00.000Z',
    } ],
  })
  ok('ISO-string DATE default accepted', db.schemas.get('ok_date_iso').name === 'ok_date_iso')

  await createCol(db,'ok_num_str', {
    props: [ { key: 'n', type: TYPES.NUMBER, format: FORMATS.TEXT, def: '42' } ],
  })
  ok('numeric-string NUMBER default accepted', db.schemas.get('ok_num_str').name === 'ok_num_str')

  await cleanup()
}

// ----- schema CRUD ------------------------------------------------------------

section('schemas: create / get / update / delete')
{
  const { db, cleanup } = await fresh()
  ok('list empty', db.schemas.list().length === 0)

  await createCol(db,'a', SIMPLE)
  ok('list has 1', db.schemas.list().length === 1)
  ok('get a', db.schemas.get('a').name === 'a')

  await throws('duplicate create → CONFLICT', () => createCol(db,'a', SIMPLE), ERR.CONFLICT)
  await throws('invalid name', () => createCol(db,'Bad Name!', SIMPLE), ERR.BAD_REQUEST)
  await throws('invalid schema', () => createCol(db,'b', { foo: 1 }), ERR.BAD_REQUEST)

  const updated = { ...SIMPLE, label: 'Renamed' }
  await updateCol(db,'a', updated)
  ok('schema updated', db.schemas.get('a').schema.label === 'Renamed')

  await db.schemas.delete('a')
  ok('list empty after delete', db.schemas.list().length === 0)
  await throws('get deleted', () => db.schemas.get('a'), ERR.NOT_FOUND)
  await cleanup()
}

section('schemas: update / delete on missing → NOT_FOUND')
{
  const { db, cleanup } = await fresh()
  await throws('update missing → NOT_FOUND', () => updateCol(db,'ghost', SIMPLE), ERR.NOT_FOUND)
  await throws('delete missing → NOT_FOUND', () => db.schemas.delete('ghost'), ERR.NOT_FOUND)
  await throws('update invalid name → BAD_REQUEST', () => updateCol(db,'Bad!', SIMPLE), ERR.BAD_REQUEST)
  await throws('update invalid schema → BAD_REQUEST',
      async () => { await createCol(db,'x', SIMPLE); await updateCol(db,'x', { foo: 1 }) },
      ERR.BAD_REQUEST)
  await cleanup()
}

section('assertValidSchema: all rejection branches')
{
  const { db, cleanup } = await fresh()
  const base = { props: [ { key: 'n', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 } ] }

  await throws('null schema', () => db.schemas.create('s1', null), ERR.BAD_REQUEST)
  await throws('missing props array', () => createCol(db,'s2', { label: 'X' }), ERR.BAD_REQUEST)
  await throws('prop without key',
      () => createCol(db,'s3', { props: [ { type: TYPES.STRING, format: FORMATS.TEXT } ] }), ERR.BAD_REQUEST)
  await throws('duplicate prop key',
      () => createCol(db,'s4', { props: [
        { key: 'a', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
        { key: 'a', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 },
      ] }), ERR.BAD_REQUEST)
  await throws('unknown type',
      () => createCol(db,'s5', { props: [ { key: 'x', type: 'bogus', format: FORMATS.TEXT, def: null } ] }), ERR.BAD_REQUEST)
  await throws('unknown format',
      () => createCol(db,'s6', { props: [ { key: 'x', type: TYPES.STRING, format: 'wild', def: '' } ] }), ERR.BAD_REQUEST)
  await throws('enum without rules.options',
      () => createCol(db,'s7', { props: [ { key: 'x', type: TYPES.ENUM, format: FORMATS.SELECT, def: 'a' } ] }), ERR.BAD_REQUEST)

  await createCol(db,'ok', base)
  ok('valid schema accepted', db.schemas.get('ok').name === 'ok')
  await cleanup()
}

section('schemas: files on disk — create / update / delete')
{
  const { db, tmp, cleanup } = await fresh()

  await createCol(db,'files', { ...SIMPLE, label: 'F1' })
  const schemaFile = path.join(tmp, 'files.schema.json')
  const dataFile   = path.join(tmp, 'files.json')
  const onDisk     = JSON.parse(await fs.readFile(schemaFile, 'utf8'))
  eq('schema file written with label', onDisk.label, 'F1')
  await db.collection('files')._flush()
  db.collection('files').create({ n: 1 })
  await db.collection('files')._flush()
  const data = JSON.parse(await fs.readFile(dataFile, 'utf8'))
  ok('data file holds the row', Array.isArray(data) && data[0].n === 1)

  await updateCol(db,'files', { ...SIMPLE, label: 'F2' })
  const updated = JSON.parse(await fs.readFile(schemaFile, 'utf8'))
  eq('schema file reflects update', updated.label, 'F2')

  await db.schemas.delete('files')
  await throws('schema file gone', () => fs.access(schemaFile), err => err?.code === 'ENOENT')
  await throws('data file gone',   () => fs.access(dataFile), err => err?.code === 'ENOENT')

  await cleanup()
}

// ----- required reference onto the own collection (first-row deadlock) ---------

section('assertValidSchema: a required reference to the OWN collection is rejected')
{
  const { db, cleanup } = await fresh()

  // a required single reference onto itself is unsatisfiable — the first row
  // would have no existing row (and may not point at itself) to reference.
  await throws('required self reference rejected on create',
      () => createCol(db, 'tree1', {
        props: [
          { key: 'name',   type: TYPES.STRING,    format: FORMATS.TEXT,                          def: '' },
          { key: 'parent', type: TYPES.REFERENCE, rules: { referenceTo: 'tree1', required: true }, def: null },
        ],
      }), ERR.BAD_REQUEST)

  // a required subset onto itself hits the same deadlock
  await throws('required self subset rejected on create',
      () => createCol(db, 'tree2', {
        props: [
          { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT,                            def: '' },
          { key: 'kids', type: TYPES.SUBSET, rules: { referenceTo: 'tree2', required: true }, def: [] },
        ],
      }), ERR.BAD_REQUEST)

  // a NON-required same-collection reference is the normal, supported case
  await createCol(db, 'tree', {
    props: [
      { key: 'name',   type: TYPES.STRING,    format: FORMATS.TEXT,           def: '' },
      { key: 'parent', type: TYPES.REFERENCE, rules: { referenceTo: 'tree' }, def: null },
    ],
  })
  ok('non-required self reference accepted', db.schemas.get('tree').name === 'tree')

  // and it cannot be made required via an ALTER either
  await throws('making a self reference required via update rejected',
      () => db.schemas.updateField('tree', 'parent', { rules: { referenceTo: 'tree', required: true } }),
      ERR.BAD_REQUEST)
  ok('self reference still optional after rejected ALTER',
      db.schemas.get('tree').schema.props.find(p => p.key === 'parent').rules?.required !== true)

  await cleanup()
}

summary()
