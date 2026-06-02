/**
 * Atomic schema/field operations (the B4 redesign, v2 single-op engine API).
 *   schemas.create(name, schema) / .delete(name)
 *   schemas.setDescription(name, value) / .setDisplayProp(name, value)
 *   schemas.addField(name, field) / .removeField(name, key)
 *   schemas.updateField(name, key, changes) / .renameField(name, key, to)
 * Each is a single, immediate, atomic mutation returning the full schema.
 *
 * Run standalone: `node src/brain/dataset/test/fieldops.js`
 */
import fs                       from 'node:fs/promises'
import path                     from 'node:path'
import { Dataset }              from '../database.js'
import { TYPES, FORMATS, ERR }  from '../../../shared/dataset/dictionary.js'
import { ok, eq, throws, section, summary, tmpDir, rmDir, createCol } from './_utils.js'

async function fresh () {
  const tmp = await tmpDir()
  const db = new Dataset(tmp)
  await db.open()
  return { db, cleanup: async () => { await db.close(); await rmDir(tmp) } }
}

const F = (key, extra = {}) => ({ key, type: TYPES.STRING, format: FORMATS.TEXT, def: '', ...extra })

// -- metadata ops -------------------------------------------------------------

section('create / setDescription / setDisplayProp / delete')
{
  const { db, cleanup } = await fresh()

  const created = await createCol(db,'books', { description: 'My books', props: [ F('title'), F('note') ] })
  eq('create returns name', created.name, 'books')
  eq('create stores description', created.schema.description, 'My books')
  ok('collection exists', db.has('books'))

  const desc = await db.schemas.setDescription('books', 'Better books')
  eq('description updated', desc.schema.description, 'Better books')

  const dp = await db.schemas.setDisplayProp('books', 'title')
  eq('displayProp set', dp.schema.displayProp, 'title')

  const cleared = await db.schemas.setDisplayProp('books', '')
  ok('displayProp cleared on empty', cleared.schema.displayProp === undefined)

  await throws('setDisplayProp to unknown field rejected',
      () => db.schemas.setDisplayProp('books', 'ghost'), ERR.BAD_REQUEST)

  const del = await db.schemas.delete('books')
  eq('delete reports name', del.name, 'books')
  ok('collection gone', db.has('books') === false)

  await cleanup()
}

section('create rejects a displayProp that is not a field (B8)')
{
  const { db, cleanup } = await fresh()
  await throws('create with bad displayProp rejected',
      () => createCol(db,'x', { displayProp: 'ghost', props: [ F('title') ] }), ERR.BAD_REQUEST)
  await cleanup()
}

// -- field ops ----------------------------------------------------------------

async function withRows () {
  const { db, cleanup } = await fresh()
  await createCol(db,'t', { description: 'T', props: [ F('label'), { key: 'n', type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0 } ] })
  const col = db.collection('t')
  col.create({ label: 'hello', n: 7 })
  col.create({ label: 'world', n: 8 })
  return { db, col, cleanup }
}

section('addField: existing rows get the default')
{
  const { db, col, cleanup } = await withRows()
  const res = await db.schemas.addField('t', F('extra', { def: 'x' }))
  ok('schema has the new field', res.schema.props.some(p => p.key === 'extra'))
  eq('existing row gets default', col.get('t-1').item.extra, 'x')
  await throws('add of an existing field rejected',
      () => db.schemas.addField('t', F('label')), ERR.CONFLICT)
  await cleanup()
}

section('removeField: drops the column')
{
  const { col, db, cleanup } = await withRows()
  await db.schemas.removeField('t', 'n')
  ok('column gone from row', col.get('t-1').item.n === undefined)
  await throws('remove unknown field rejected',
      () => db.schemas.removeField('t', 'ghost'), ERR.BAD_REQUEST)
  await cleanup()
}

section('updateField: changes type and re-coerces')
{
  const { col, db, cleanup } = await withRows()
  await db.schemas.updateField('t', 'n', { type: TYPES.STRING, format: FORMATS.TEXT, def: '' })
  eq('number coerced to string', col.get('t-1').item.n, '7')
  await throws('update cannot change the key',
      () => db.schemas.updateField('t', 'n', { key: 'm' }), ERR.BAD_REQUEST)
  await throws('update unknown field rejected',
      () => db.schemas.updateField('t', 'ghost', { def: 'z' }), ERR.BAD_REQUEST)
  await cleanup()
}

section('renameField: preserves data (B4)')
{
  const { col, db, cleanup } = await withRows()
  const res = await db.schemas.renameField('t', 'label', 'name')
  ok('schema shows new key', res.schema.props.some(p => p.key === 'name'))
  ok('schema dropped old key', !res.schema.props.some(p => p.key === 'label'))
  eq('row value preserved (1)', col.get('t-1').item.name, 'hello')
  eq('row value preserved (2)', col.get('t-2').item.name, 'world')
  ok('old key gone from row', col.get('t-1').item.label === undefined)
  eq('other field intact', col.get('t-1').item.n, 7)

  await throws('rename to an existing key rejected',
      () => db.schemas.renameField('t', 'name', 'n'), ERR.CONFLICT)
  await throws('rename unknown field rejected',
      () => db.schemas.renameField('t', 'ghost', 'x'), ERR.BAD_REQUEST)
  await cleanup()
}

section('updateField: changing type resets an incompatible format to the type default')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', { props: [ { key: 'kind', type: TYPES.ENUM, format: FORMATS.SELECT, rules: { options: [ 'a', 'b' ] }, def: 'a' } ] })

  const res = await db.schemas.updateField('t', 'kind', { type: TYPES.NUMBER, def: 0 })
  const kind = res.schema.props.find(p => p.key === 'kind')
  eq('type changed', kind.type, TYPES.NUMBER)
  eq('format reset to the number default', kind.format, FORMATS.TEXT)
  ok('a note explains the format reset', Array.isArray(res.notes) && res.notes.some(n => /format/i.test(n)))
  await cleanup()
}

section('displayProp follows a rename and clears on remove')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', { description: 'T', displayProp: 'title', props: [ F('title'), F('body') ] })

  const renamed = await db.schemas.renameField('t', 'title', 'headline')
  eq('displayProp retargeted by rename', renamed.schema.displayProp, 'headline')

  const removed = await db.schemas.removeField('t', 'headline')
  ok('displayProp cleared when its field is removed', removed.schema.displayProp === undefined)
  await cleanup()
}

section('create defaults an omitted format to a valid one per type (UI editors require it)')
{
  const { db, cleanup } = await fresh()
  const created = await createCol(db, 'f', { props: [
    { key: 'name',  type: TYPES.STRING,  def: '' },     // no format → text
    { key: 'count', type: TYPES.NUMBER,  def: 0 },      // → text
    { key: 'done',  type: TYPES.BOOLEAN, def: false },  // → checkbox
    { key: 'when',  type: TYPES.DATE,    def: null },   // → datepicker
    { key: 'level', type: TYPES.ENUM,    rules: { options: [ 'a', 'b' ] }, def: 'a' }, // → select
    { key: 'tags',  type: TYPES.ARRAY,   def: [] },     // format-free → none
  ] })
  const f = k => created.schema.props.find(p => p.key === k)
  eq('string defaults to text',    f('name').format,  FORMATS.TEXT)
  eq('number defaults to text',    f('count').format, FORMATS.TEXT)
  eq('boolean defaults to checkbox', f('done').format, FORMATS.CHECKBOX)
  eq('date defaults to datepicker', f('when').format, FORMATS.DATEPICKER)
  eq('enum defaults to select',    f('level').format, FORMATS.SELECT)
  ok('array stays format-free',    f('tags').format === undefined)
  await cleanup()
}

section('a legacy schema file with no scalar formats is served complete, file left as-is (no heal)')
{
  const tmp = await tmpDir()
  const file = path.join(tmp, 'legacy.schema.json')
  const legacy = { idgen: { prefix: 'L' }, props: [ { key: 'n', type: TYPES.NUMBER, def: 0 } ] }
  await fs.writeFile(file, JSON.stringify(legacy))

  const db = new Dataset(tmp)
  await db.open()
  eq('served schema has the format filled in', db.schemas.get('legacy').schema.props[0].format, FORMATS.TEXT)
  await db.close()

  const onDisk = JSON.parse(await fs.readFile(file, 'utf8'))
  ok('stored file was not rewritten (no heal)', onDisk.props[0].format === undefined)
  await rmDir(tmp)
}

summary()
