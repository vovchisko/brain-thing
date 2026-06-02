import { RPC }       from '../../shared/dataset/dictionary.js'
import { callDataset } from './_db_helpers.js'
import { createBus }   from '../lib/bus.js'

const bus = createBus('db_create')

export async function handle ({ collection, data } = {}) {
  const ev = bus.op(collection || '(none)')
  const res = await callDataset(RPC.COLLECTION_CREATE, { collection, data })
  ev.ok(`#${ res.item.id }`)
  return { text: `Created row ${ res.item.id } in "${ collection }".` }
}
