import { reactive } from 'vue'
import Sig          from 'a-signal'
import { ErrorGeneric, EVENT } from '@shared/dictionary.js'
import { sync }                from './sync.js'

export const CONN = Object.freeze({
  IDLE:         'idle',
  CONNECTING:   'connecting',
  READY:        'ready',
  RECONNECTING: 'reconnecting',
  OFFLINE:      'offline',
})

const status = reactive({ wse: CONN.READY })

const when = {
  ready: new Sig({ late: true, memorable: true }),
}

const EVENT_HANDLERS = {
  [EVENT.ITEM_CREATED]:   sync.itemCreated,
  [EVENT.ITEM_UPDATED]:   sync.itemUpdated,
  [EVENT.ITEM_DELETED]:   sync.itemDeleted,
  [EVENT.SCHEMA_CREATED]: sync.schemaCreated,
  [EVENT.SCHEMA_UPDATED]: sync.schemaUpdated,
  [EVENT.SCHEMA_DELETED]: sync.schemaDeleted,
}

const ipc = window.api?.dataset
if (ipc) {
  ipc.on(({ kind, payload }) => {
    const fn = EVENT_HANDLERS[kind]
    if (fn) fn(payload)
  })
}

const transport = {
  async call (name, payload) {
    if (!ipc) throw new ErrorGeneric('SERVICE_UNAVAILABLE', 'Dataset IPC bridge unavailable.')
    // Vue's reactive() returns a Proxy that Electron's structured-clone IPC
    // chokes on. JSON round-trip strips proxies and matches the JSON-only
    // wire shape the dataset module expects.
    const safe = payload === undefined ? undefined : JSON.parse(JSON.stringify(payload))
    const res = await ipc.call(name, safe)
    if (!res?.ok) {
      const err = res?.error || {}
      throw new ErrorGeneric(err.code || 'UNEXPECTED_ERROR', err.text || err.message || '')
    }
    return res.data
  },
}

async function connect () {
  when.ready.emit(true)
}

export const net = {
  wse: transport,
  status,
  when,
  connect,
}
