import { RPC }         from '../../shared/dataset/dictionary.js'
import { callDataset } from './_db_helpers.js'
import { createBus }   from '../lib/bus.js'

const bus = createBus('db_create_many')

export async function handle ({ collection, rows } = {}) {
  const ev = bus.op(collection || '(none)')
  const res = await callDataset(RPC.COLLECTION_CREATE_MANY, { collection, rows })
  const ids = (res?.items || []).map(i => i.id)
  ev.ok(`${ ids.length } row(s)`)
  return { text: `Created ${ ids.length } row(s) in "${ collection }". ids: ${ ids.join(', ') }` }
}
