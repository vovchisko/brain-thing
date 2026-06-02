import { RPC }       from '../../shared/dataset/dictionary.js'
import { callDataset } from './_db_helpers.js'
import { createBus }   from '../lib/bus.js'

const bus = createBus('db_delete')

export async function handle ({ collection, id, force } = {}) {
  const ev = bus.op(`${ collection || '(none)' }#${ id }`)
  const res = await callDataset(RPC.COLLECTION_DELETE, { collection, id, force })
  ev.ok('deleted')
  const n = res?.cleared?.length || 0
  return { text: `Deleted row ${ id } from "${ collection }".` + (n ? ` Cleared ${ n } reference(s) to it in other rows.` : '') }
}
