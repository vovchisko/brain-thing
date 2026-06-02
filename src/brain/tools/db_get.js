import { RPC }              from '../../shared/dataset/dictionary.js'
import { callDataset, renderRows } from './_db_helpers.js'
import { createBus }         from '../lib/bus.js'

const bus = createBus('db_get')

export async function handle ({ collection, id } = {}) {
  const ev = bus.op(`${ collection || '(none)' }#${ id }`)
  const { schema } = await callDataset(RPC.SCHEMA_GET, { name: collection })
  const res = await callDataset(RPC.COLLECTION_GET, { collection, id })
  ev.ok('found')
  return { text: renderRows(res, collection, schema) }
}
