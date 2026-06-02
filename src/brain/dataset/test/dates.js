/**
 * Date contract: store UTC, do I/O in local; zoneless = local, explicit zone
 * honored, epoch ms absolute; sentinels now/today; per-prop precision.
 *
 * Assertions are timezone-independent (round-trip + consistency + absolute-UTC
 * for explicitly-zoned input), so they pass on any host. One check is gated on a
 * non-UTC host to prove zoneless really is read as local.
 *
 * Run standalone: `node src/brain/dataset/test/dates.js`
 */
process.env.TZ = 'Etc/GMT-2' // UTC+2, no DST — deterministic where the runtime honors it

import { Dataset }              from '../database.js'
import { dates }               from '../../../shared/dataset/dates.js'
import { TYPES, FORMATS, ERR }  from '../../../shared/dataset/dictionary.js'
import { ok, eq, throws, section, summary, tmpDir, rmDir, createCol } from './_utils.js'

async function fresh () {
  const tmp = await tmpDir()
  const db = new Dataset(tmp)
  await db.open()
  return { db, cleanup: async () => { await db.close(); await rmDir(tmp) } }
}

// -- pure parse ---------------------------------------------------------------

section('parse: explicit zone is honored (absolute UTC)')
{
  eq('Z kept exact', dates.parse('2020-01-15T10:30:00Z', 'second'), '2020-01-15T10:30:00.000Z')
  eq('+02:00 converted to UTC', dates.parse('2020-01-15T10:30:00+02:00', 'second'), '2020-01-15T08:30:00.000Z')
  eq('epoch 0 is absolute', dates.parse(0, 'second'), '1970-01-01T00:00:00.000Z')
}

section('parse: zoneless round-trips in local time')
{
  eq('date-only round-trips (day)', dates.format(dates.parse('2020-01-15', 'day'), 'day'), '2020-01-15')
  eq('datetime round-trips (minute)', dates.format(dates.parse('2020-01-15 14:30', 'minute'), 'minute'), '2020-01-15 14:30')
  eq('datetime round-trips (second, T-form)', dates.format(dates.parse('2020-01-15T14:30:45', 'second'), 'second'), '2020-01-15 14:30:45')
}

section('parse: date-only and human form agree (B5 regression)')
{
  eq('YYYY-MM-DD === "Jan 15 2020"',
      dates.parse('2020-01-15', 'day'), dates.parse('Jan 15 2020', 'day'))
}

section('precision is display-only: parse keeps the instant, format trims it')
{
  const stored = dates.parse('2020-01-15T14:30:00')   // precision no longer affects storage
  eq('full instant kept in storage', dates.format(stored, 'minute'), '2020-01-15 14:30')
  eq('day precision trims to date on output', dates.format(stored, 'day'), '2020-01-15')
  eq('default precision (day) hides the time', dates.format(stored), '2020-01-15')
}

section('parse: garbage and roll-over rejected')
{
  await throws('month 13 rejected', () => dates.parse('2020-13-45'), ERR.BAD_REQUEST)
  await throws('day 45 rejected', () => dates.parse('2020-02-45'), ERR.BAD_REQUEST)
  await throws('not a date rejected', () => dates.parse('definitely not a date'), ERR.BAD_REQUEST)
  await throws('hour 99 rejected', () => dates.parse('2020-01-15 99:00'), ERR.BAD_REQUEST)
  eq('null passes through', dates.parse(null), null)
}

section('sentinels: now / now() / today')
{
  ok('now resolves to a UTC ISO', /Z$/.test(dates.parse('now', 'second')))
  ok('now() is an alias', /Z$/.test(dates.parse('now()', 'second')))
  eq('today === local midnight today',
      dates.format(dates.parse('today', 'day'), 'day'),
      dates.format(new Date().toISOString(), 'day'))
}

section('zoneless read as local when host is non-UTC (gated)')
{
  if (new Date(2020, 0, 15).getTimezoneOffset() !== 0) {
    ok('zoneless ≠ its UTC interpretation', dates.parse('2020-01-15T00:00:00', 'second') !== '2020-01-15T00:00:00.000Z')
  } else {
    ok('host is UTC — local==UTC, skipped', true)
  }
}

// -- through the collection ---------------------------------------------------

section('schema: precision validated; def "now" auto-sets on create')
{
  const { db, cleanup } = await fresh()

  await throws('bad precision rejected',
      () => createCol(db,'bad', { props: [
        { key: 'd', type: TYPES.DATE, format: FORMATS.DATEPICKER, rules: { precision: 'fortnight' }, def: null },
      ] }), ERR.BAD_REQUEST)

  await createCol(db,'events', {
    props: [
      { key: 'name',    type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
      { key: 'on',      type: TYPES.DATE,   format: FORMATS.DATEPICKER, rules: { precision: 'day' },    def: null },
      { key: 'created', type: TYPES.DATE,   format: FORMATS.DATEPICKER, rules: { precision: 'second' }, def: 'now' },
    ],
  })
  const col = db.collection('events')
  const r = col.create({ name: 'launch', on: '2020-01-15' }).item
  ok('date stored as UTC ISO', /Z$/.test(r.on))
  ok('def:"now" resolved on create', typeof r.created === 'string' && /Z$/.test(r.created))
  eq('day precision round-trips', dates.format(r.on, 'day'), '2020-01-15')

  const empty = col.create({ name: 'no date' }).item
  eq('null date stays null', empty.on, null)
  ok('created still auto-set when other fields omitted', /Z$/.test(empty.created))
  await cleanup()
}

summary()
