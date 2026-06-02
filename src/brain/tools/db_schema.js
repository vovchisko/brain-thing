import { RPC }                                       from '../../shared/dataset/dictionary.js'
import { callDataset, renderSchema, renderSchemas }  from './_db_helpers.js'
import { createBus }                                 from '../lib/bus.js'

const bus = createBus('db_schema')

/** Read structure. `name` → that collection's full schema; omitted → all collections. */
export async function handle ({ name } = {}) {
  if (name) {
    bus.info(name)
    const res = await callDataset(RPC.SCHEMA_GET, { name })
    return { text: renderSchema(res) }
  }
  const list = await callDataset(RPC.SCHEMA_LIST)
  bus.info(`${ list.length } collection(s)`)
  return { text: renderSchemas(list) }
}
