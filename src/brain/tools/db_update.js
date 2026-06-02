import { RPC }       from '../../shared/dataset/dictionary.js'
import { callDataset } from './_db_helpers.js'
import { createBus }   from '../lib/bus.js'

const bus = createBus('db_update')

export async function handle ({ collection, id, data } = {}) {
  const ev = bus.op(`${ collection || '(none)' }#${ id }`)
  await callDataset(RPC.COLLECTION_UPDATE, { collection, id, data })
  ev.ok('updated')
  return { text: `Updated row ${ id } in "${ collection }".` }
}
