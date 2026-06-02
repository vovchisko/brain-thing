/**
 * Querying: offset pagination, sort, and server-side filters
 * (eq/in/lt/gt/contains/starts/has/hasAny) with value coercion + validation.
 *
 * The "rich" fixture seeds a real "tags" collection and references its ids, so
 * subset values satisfy referential integrity (see refs.js).
 *
 * Run standalone: `node src/brain/dataset/test/query.js`
 */
import { Dataset }              from '../database.js'
import { filters }              from '../../../shared/dataset/filters.js'
import { TYPES, FORMATS, ERR }  from '../../../shared/dataset/dictionary.js'
import { ok, eq, throws, section, summary, tmpDir, rmDir, createCol } from './_utils.js'

// rows carry prefixed ids ("<prefix>-<n>"); these assertions identify rows by
// the numeric counter suffix, so strip the prefix for terse expectations.
const ids = (arr) => arr.map(e => e.id.split('-').pop())

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

const RICH = {
  label: 'Rich',
  props: [
    { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
    { key: 'kind', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
    { key: 'n',    type: TYPES.NUMBER, format: FORMATS.TEXT, def: null },
    { key: 'tags', type: TYPES.SUBSET, rules: { referenceTo: 'tags' }, def: [] },
    { key: 'when', type: TYPES.DATE,   format: FORMATS.DATEPICKER, def: null },
  ],
}

// -- list (paginate forward) --------------------------------------------------

section('list — offset mode (default)')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', SIMPLE)
  const col = db.collection('t')
  for (let i = 1; i <= 10; i++) col.create({ n: i })

  const p1 = col.list({ offset: 0, limit: 3 })
  eq('page 1 ids', ids(p1.data), [ '1', '2', '3' ])
  eq('total reported', p1.total, 10)
  ok('hasMore on page 1', p1.hasMore === true)

  const p2 = col.list({ offset: 3, limit: 3 })
  eq('page 2 ids', ids(p2.data), [ '4', '5', '6' ])

  const last = col.list({ offset: 9, limit: 3 })
  eq('last page ids', ids(last.data), [ '10' ])
  ok('no hasMore on last page', last.hasMore === false)

  const beyond = col.list({ offset: 100, limit: 3 })
  eq('offset beyond end → empty', beyond.data, [])
  ok('beyond still reports total', beyond.total === 10)

  await throws('negative offset rejected', () => col.list({ offset: -1 }), ERR.BAD_REQUEST)
  await throws('zero limit rejected', () => col.list({ limit: 0 }), ERR.BAD_REQUEST)
  await throws('non-integer limit rejected', () => col.list({ limit: 2.5 }), ERR.BAD_REQUEST)
  await cleanup()
}

// -- list (sort) --------------------------------------------------------------

section('list — sort')
{
  const { db, cleanup } = await fresh()
  await createCol(db,'t', {
    props: [
      { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' },
      { key: 'n',    type: TYPES.NUMBER, format: FORMATS.TEXT, def: null },
      { key: 'when', type: TYPES.DATE,   format: FORMATS.DATEPICKER, def: null },
      { key: 'flag', type: TYPES.BOOLEAN, format: FORMATS.CHECKBOX, def: false },
      { key: 'kind', type: TYPES.ENUM,   format: FORMATS.SELECT, rules: { options: [ 'low', 'med', 'high' ] }, def: 'med' },
      { key: 'tags', type: TYPES.SUBSET, rules: { referenceTo: 't' }, def: [] },
    ],
  })
  const col = db.collection('t')
  col.create({ name: 'banana', n: 20, when: '2024-02-01T00:00:00Z', flag: true,  kind: 'high' })
  col.create({ name: 'apple',  n: 10, when: '2024-01-01T00:00:00Z', flag: false, kind: 'low'  })
  col.create({ name: 'cherry', n: 30, when: '2024-03-01T00:00:00Z', flag: true,  kind: 'med'  })
  col.create({ name: 'apricot', n: null, when: null, flag: false, kind: 'low' })

  eq('sort name asc',  ids(col.list({ sort: { key: 'name', dir: 'asc' } }).data),  [ '2', '4', '1', '3' ])
  eq('sort name desc', ids(col.list({ sort: { key: 'name', dir: 'desc' } }).data), [ '3', '1', '4', '2' ])
  eq('sort n asc — null last',  ids(col.list({ sort: { key: 'n', dir: 'asc' } }).data),  [ '2', '1', '3', '4' ])
  eq('sort n desc — null first', ids(col.list({ sort: { key: 'n', dir: 'desc' } }).data), [ '4', '3', '1', '2' ])
  eq('sort when asc', ids(col.list({ sort: { key: 'when', dir: 'asc' } }).data),  [ '2', '1', '3', '4' ])
  eq('sort flag asc', ids(col.list({ sort: { key: 'flag', dir: 'asc' } }).data).slice(0, 2).sort(), [ '2', '4' ])
  eq('sort kind asc — lexicographic', ids(col.list({ sort: { key: 'kind', dir: 'asc' } }).data),  [ '1', '2', '4', '3' ])
  eq('sort id desc — numeric, not lexicographic',
      ids(col.list({ sort: { key: 'id', dir: 'desc' } }).data),  [ '4', '3', '2', '1' ])

  const p = col.list({
    filters: [ { key: 'kind', op: 'in', value: [ 'low', 'med' ] } ],
    sort:    { key: 'n', dir: 'desc' },
    offset:  1,
    limit:   2,
  })
  eq('filter+sort+offset', ids(p.data), [ '3', '2' ])
  eq('filtered+sorted total', p.total, 3)

  eq('omitted dir → asc', ids(col.list({ sort: { key: 'name' } }).data), [ '2', '4', '1', '3' ])

  await throws('array sort rejected',  () => col.list({ sort: [ { key: 'name' } ] }), ERR.BAD_REQUEST)
  await throws('string sort rejected', () => col.list({ sort: 'name' }), ERR.BAD_REQUEST)
  await throws('sort without key',     () => col.list({ sort: { dir: 'asc' } }), ERR.BAD_REQUEST)
  await throws('sort bad dir',         () => col.list({ sort: { key: 'name', dir: 'sideways' } }), ERR.BAD_REQUEST)
  await throws('sort unknown key',     () => col.list({ sort: { key: 'nope' } }), ERR.BAD_REQUEST)

  await cleanup()
}

// -- list (sort by reference / subset / array) --------------------------------

section('list — sort by reference label + list count')
{
  const { db, cleanup } = await fresh()
  await createCol(db, 'people', {
    displayProp: 'name',
    props: [ { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' } ],
  })
  const people = db.collection('people')
  const alice = people.create({ name: 'Alice' }).item
  const bob   = people.create({ name: 'Bob' }).item
  const carol = people.create({ name: 'Carol' }).item

  await createCol(db, 'tasks', {
    props: [
      { key: 'title',    type: TYPES.STRING,    format: FORMATS.TEXT,             def: '' },
      { key: 'owner',    type: TYPES.REFERENCE, rules: { referenceTo: 'people' }, def: null },
      { key: 'watchers', type: TYPES.SUBSET,    rules: { referenceTo: 'people' }, def: [] },
      { key: 'labels',   type: TYPES.ARRAY,                                       def: [] },
    ],
  })
  const tasks = db.collection('tasks')
  tasks.create({ title: 'a', owner: carol.id, watchers: [ alice.id, bob.id, carol.id ], labels: [ 'x' ] })          // owner Carol · 3 watchers · 1 label
  tasks.create({ title: 'b', owner: alice.id, watchers: [],                             labels: [ 'x', 'y', 'z' ] }) // owner Alice · 0 watchers · 3 labels
  tasks.create({ title: 'c', owner: bob.id,   watchers: [ alice.id ],                   labels: [ 'x', 'y' ] })      // owner Bob   · 1 watcher  · 2 labels
  tasks.create({ title: 'd', owner: null,     watchers: [ bob.id, carol.id ],           labels: [] })                // no owner    · 2 watchers · 0 labels

  // reference → ordered by the target row's display label; empty ref sorts to the edge
  eq('reference label asc (empty last)',
      ids(tasks.list({ sort: { key: 'owner', dir: 'asc' } }).data),  [ '2', '3', '1', '4' ])
  eq('reference label desc (empty first)',
      ids(tasks.list({ sort: { key: 'owner', dir: 'desc' } }).data), [ '4', '1', '3', '2' ])

  // subset → ordered by element count
  eq('subset count asc',  ids(tasks.list({ sort: { key: 'watchers', dir: 'asc' } }).data),  [ '2', '3', '4', '1' ])
  eq('subset count desc', ids(tasks.list({ sort: { key: 'watchers', dir: 'desc' } }).data), [ '1', '4', '3', '2' ])

  // plain array → same, by element count
  eq('array count asc',  ids(tasks.list({ sort: { key: 'labels', dir: 'asc' } }).data),  [ '4', '1', '3', '2' ])

  await cleanup()
}

// -- filters (server-side) ----------------------------------------------------

// red=1 sweet=2 yellow=3 orange=4 brown=5
async function withRich () {
  const { db, cleanup } = await fresh()
  await createCol(db,'tags', { props: [ { key: 'name', type: TYPES.STRING, format: FORMATS.TEXT, def: '' } ] })
  const tags = db.collection('tags')
  const T = {}
  for (const name of [ 'red', 'sweet', 'yellow', 'orange', 'brown' ]) T[name] = tags.create({ name }).item.id

  await createCol(db,'items', RICH)
  const col = db.collection('items')
  col.create({ name: 'apple',   kind: 'fruit', n: 10, tags: [ T.red, T.sweet ],    when: '2024-01-01T00:00:00Z' })
  col.create({ name: 'banana',  kind: 'fruit', n: 20, tags: [ T.yellow, T.sweet ], when: '2024-02-01T00:00:00Z' })
  col.create({ name: 'carrot',  kind: 'veg',   n: 30, tags: [ T.orange ],          when: '2024-03-01T00:00:00Z' })
  col.create({ name: 'apricot', kind: 'fruit', n: null, tags: [],                  when: null })
  col.create({ name: 'date',    kind: 'fruit', n: 5,  tags: [ T.sweet, T.brown ],  when: '2024-04-01T00:00:00Z' })
  return { db, col, T, cleanup }
}

section('filters: eq / in')
{
  const { col, cleanup } = await withRich()
  eq('kind=veg', ids(col.list({ filters: [ { key: 'kind', op: 'eq', value: 'veg' } ], limit: 50 }).data), [ '3' ])
  eq('kind in [veg,fruit]', ids(col.list({ filters: [ { key: 'kind', op: 'in', value: [ 'veg', 'fruit' ] } ], limit: 50 }).data), [ '1', '2', '3', '4', '5' ])
  await throws('non-array to "in" rejected', () => col.list({ filters: [ { key: 'kind', op: 'in', value: 'veg' } ] }), ERR.BAD_REQUEST)
  await cleanup()
}

section('filters: lt / gt')
{
  const { col, cleanup } = await withRich()
  eq('n < 20', ids(col.list({ filters: [ { key: 'n', op: 'lt', value: 20 } ], limit: 50 }).data), [ '1', '5' ])
  eq('n > 20', ids(col.list({ filters: [ { key: 'n', op: 'gt', value: 20 } ], limit: 50 }).data), [ '3' ])
  ok('null n excluded', !ids(col.list({ filters: [ { key: 'n', op: 'lt', value: 999 } ], limit: 50 }).data).includes('4'))
  eq('when > 2024-02-15',
     ids(col.list({ filters: [ { key: 'when', op: 'gt', value: '2024-02-15T00:00:00Z' } ], limit: 50 }).data),
     [ '3', '5' ])
  await cleanup()
}

section('filters: contains / starts')
{
  const { col, cleanup } = await withRich()
  eq('name contains "ap"', ids(col.list({ filters: [ { key: 'name', op: 'contains', value: 'AP' } ], limit: 50 }).data), [ '1', '4' ])
  eq('name starts "a"', ids(col.list({ filters: [ { key: 'name', op: 'starts', value: 'A' } ], limit: 50 }).data), [ '1', '4' ])
  await cleanup()
}

section('filters: has / hasAny')
{
  const { col, T, cleanup } = await withRich()
  eq('tags has sweet', ids(col.list({ filters: [ { key: 'tags', op: 'has', value: T.sweet } ], limit: 50 }).data), [ '1', '2', '5' ])
  eq('hasAny [red,orange]', ids(col.list({ filters: [ { key: 'tags', op: 'hasAny', value: [ T.red, T.orange ] } ], limit: 50 }).data), [ '1', '3' ])
  await cleanup()
}

section('filters: combined AND')
{
  const { col, T, cleanup } = await withRich()
  const r = col.list({ filters: [
    { key: 'kind', op: 'eq', value: 'fruit' },
    { key: 'tags', op: 'has', value: T.sweet },
  ], limit: 50 })
  eq('fruit AND has sweet', ids(r.data), [ '1', '2', '5' ])
  ok('filtered total=3', r.total === 3)
  await cleanup()
}

section('filters: value coercion + validation')
{
  const { col, cleanup } = await withRich()

  eq('eq: string "10" matches number 10',
     ids(col.list({ filters: [ { key: 'n', op: 'eq', value: '10' } ], limit: 50 }).data), [ '1' ])
  eq('gt: string "20" compares numerically (not lexically)',
     ids(col.list({ filters: [ { key: 'n', op: 'gt', value: '20' } ], limit: 50 }).data), [ '3' ])
  eq('in: mixed-typed values coerced',
     ids(col.list({ filters: [ { key: 'n', op: 'in', value: [ '10', 30 ] } ], limit: 50 }).data), [ '1', '3' ])
  eq('gt: Date object on a date field',
     ids(col.list({ filters: [ { key: 'when', op: 'gt', value: new Date('2024-02-15T00:00:00Z') } ], limit: 50 }).data), [ '3', '5' ])

  await throws('unknown field rejected',
      () => col.list({ filters: [ { key: 'nope', op: 'eq', value: 1 } ] }), ERR.BAD_REQUEST)
  await throws('unknown operator rejected',
      () => col.list({ filters: [ { key: 'n', op: 'wat', value: 1 } ] }), ERR.BAD_REQUEST)
  await throws('uncoercible value rejected',
      () => col.list({ filters: [ { key: 'n', op: 'eq', value: 'abc' } ] }), ERR.BAD_REQUEST)
  await throws('"in" with non-array rejected',
      () => col.list({ filters: [ { key: 'n', op: 'in', value: 5 } ] }), ERR.BAD_REQUEST)
  await throws('"hasAny" with non-array rejected',
      () => col.list({ filters: [ { key: 'tags', op: 'hasAny', value: 'x' } ] }), ERR.BAD_REQUEST)
  await throws('malformed filter (no key) rejected',
      () => col.list({ filters: [ { op: 'eq', value: 1 } ] }), ERR.BAD_REQUEST)
  await throws('filter error carries a human message',
      () => col.list({ filters: [ { key: 'nope', op: 'eq', value: 1 } ] }),
      err => err?.text?.includes('unknown field "nope"'))
  await cleanup()
}

// -- pure filter matching -----------------------------------------------------

section('filters singleton: matchesFilters (pure, ids as values)')
{
  const e = { id: '1', name: 'apple', n: 5, tags: [ '1', '2' ] }
  ok('matchesFilters: empty → true', filters.matchesFilters(e, []) === true)
  ok('matchesFilters: null → true', filters.matchesFilters(e, null) === true)
  ok('matchesFilters: eq match', filters.matchesFilters(e, [ { key: 'name', op: 'eq', value: 'apple' } ]))
  ok('matchesFilters: AND match',
     filters.matchesFilters(e, [
       { key: 'n', op: 'gt', value: 3 },
       { key: 'tags', op: 'has', value: '1' },
     ]))
  ok('matchesFilters: one fails → false',
     filters.matchesFilters(e, [ { key: 'n', op: 'gt', value: 99 } ]) === false)
}

summary()
