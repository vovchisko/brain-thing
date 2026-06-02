import { RPC }              from '../../shared/dataset/dictionary.js'
import { callDataset, renderRows } from './_db_helpers.js'
import { createBus }         from '../lib/bus.js'

const bus = createBus('db_query')

export async function handle ({ collection, filters, sort, offset, limit } = {}) {
  const ev = bus.op(collection || '(none)')
  const { schema } = await callDataset(RPC.SCHEMA_GET, { name: collection })
  const res = await callDataset(RPC.COLLECTION_LIST, { collection, filters, sort, offset, limit })
  ev.ok(`${ res.data.length }/${ res.total }`)
  return { text: renderRows(res, collection, schema) }
}
