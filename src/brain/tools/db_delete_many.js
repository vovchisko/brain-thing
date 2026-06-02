import { RPC }         from '../../shared/dataset/dictionary.js'
import { callDataset } from './_db_helpers.js'
import { createBus }   from '../lib/bus.js'

const bus = createBus('db_delete_many')

export async function handle ({ collection, ids, force } = {}) {
  const ev = bus.op(collection || '(none)')
  const res = await callDataset(RPC.COLLECTION_DELETE_MANY, { collection, ids, force })
  const n = (res?.deleted || []).length
  const cleared = res?.cleared?.length || 0
  ev.ok(`${ n } row(s)`)
  return { text: `Deleted ${ n } row(s) from "${ collection }".` + (cleared ? ` Cleared ${ cleared } reference(s) to them in other rows.` : '') }
}
