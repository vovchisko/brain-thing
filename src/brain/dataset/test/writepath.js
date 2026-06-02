/**
 * Write-path contract (P1/P3/P4):
 *   P1 — unknown input fields are rejected (named, with a closest-match hint),
 *        never silently dropped. Applies to create and update.
 *   P3 — required fields must hold a value. A field is required via
 *        rules.required, or by being the displayProp (unless opted out).
 *   P4 — "", null and an absent key are all "no value": default on create,
 *        clear on update.
 *
 * Run standalone: `node src/brain/dataset/test/writepath.js`
 */
import { Dataset }              from '../database.js'
import { TYPES, FORMATS, ERR }  from '../../../shared/dataset/dictionary.js'
import { ok, eq, throws, section, summary, tmpDir, rmDir, createCol } from './_utils.js'

async function fresh () {
  const tmp = await tmpDir()
  const db = new Dataset(tmp)
  await db.open()
  return { db, cleanup: async () => { await db.close(); await rmDir(tmp) } }
}

const S = (key, extra = {}) => ({ key, type: TYPES.STRING, format: FORMATS.TEXT, def: '', ...extra })
const N = (key, extra = {}) => ({ key, type: TYPES.NUMBER, format: FORMATS.TEXT, def: 0, ...extra })

// -- P1 — unknown fields ------------------------------------------------------

section('P1: unknown field on create/update is rejected, not dropped')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', { props: [ S('title'), N('pages') ] })
  const col = db.collection('t')

  await throws('create with an unknown field rejected',
      () => col.create({ title: 'x', bogus: 'y' }), ERR.BAD_REQUEST)
  await throws('error names the unknown field and lists valid ones',
      () => col.create({ bogus: 'y' }),
      err => err?.text?.includes('"bogus"') && err.text.includes('title') && err.text.includes('pages'))
  await throws('typo gets a "did you mean" hint',
      () => col.create({ titel: 'x' }),
      err => err?.text?.includes('Did you mean "title"'))

  const row = col.create({ title: 'ok' }).item
  await throws('update with an unknown field rejected',
      () => col.update(row.id, { nope: 1 }), ERR.BAD_REQUEST)
  ok('id is not treated as unknown', col.create({ title: 'z', id: 'ignored' }).item.title === 'z')

  await cleanup()
}

// -- P3 — required fields -----------------------------------------------------

section('P3: explicit required field must have a value on create')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', { props: [ S('title', { rules: { required: true } }), N('pages') ] })
  const col = db.collection('t')

  await throws('missing required field rejected', () => col.create({ pages: 3 }), ERR.BAD_REQUEST)
  await throws('empty-string required field rejected', () => col.create({ title: '' }), ERR.BAD_REQUEST)
  ok('present required field accepted', col.create({ title: 'ok' }).item.title === 'ok')

  await cleanup()
}

section('P3: displayProp is required by default, unless opted out')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', { displayProp: 'name', props: [ S('name'), N('age') ] })
  const col = db.collection('t')

  await throws('blank-labelled row rejected (displayProp implicit-required)',
      () => col.create({ age: 5 }), ERR.BAD_REQUEST)
  ok('labelled row accepted', col.create({ name: 'Bob' }).item.name === 'Bob')

  // opt the displayProp out of required
  await createCol(db,'u', { displayProp: 'name', props: [ S('name', { rules: { required: false } }) ] })
  ok('opted-out displayProp allows a blank row', db.collection('u').create({}).item.name === '')

  await cleanup()
}

section('P3: clearing a required field on update is rejected')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', { props: [ S('title', { rules: { required: true } }) ] })
  const col = db.collection('t')
  const row = col.create({ title: 'keep' }).item
  await throws('clearing required field to "" rejected', () => col.update(row.id, { title: '' }), ERR.BAD_REQUEST)
  await throws('clearing required field to null rejected', () => col.update(row.id, { title: null }), ERR.BAD_REQUEST)
  eq('row unchanged after rejected clear', col.get(row.id).item.title, 'keep')
  await cleanup()
}

// -- P4 — empty = no value ----------------------------------------------------

section('P4: "" / null = no value → default on create')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', { props: [ S('title', { def: 'untitled' }), N('pages', { def: 0 }) ] })
  const col = db.collection('t')

  eq('empty string → string default', col.create({ title: '' }).item.title, 'untitled')
  eq('empty string → number default (no coercion error)', col.create({ pages: '' }).item.pages, 0)
  eq('null → number default', col.create({ pages: null }).item.pages, 0)

  await cleanup()
}

section('P4: "" / null on update clears the field')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', { props: [ S('title', { def: 'untitled' }), N('pages', { def: 0 }) ] })
  const col = db.collection('t')
  const row = col.create({ title: 'set', pages: 42 }).item

  col.update(row.id, { title: '' })
  ok('empty string clears to null on update', col.get(row.id).item.title === null)
  col.update(row.id, { pages: null })
  ok('null clears the number on update', col.get(row.id).item.pages === null)

  await cleanup()
}

summary()
