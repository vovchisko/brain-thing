import { join }      from 'node:path'
import { mkdirSync } from 'node:fs'
import Sig           from 'a-signal'
import { Dataset }   from './database.js'
import { createBus } from '../lib/bus.js'
import { RPC, EVENT, SCHEMA_EDIT, ERR, ErrorGeneric } from '../../shared/dataset/dictionary.js'

const bus = createBus('dataset')

let _db = null

const ready = new Sig({ late: true, memorable: true })
const eventSink = new Sig()

function schemaFromCreateOp (op) {
  const schema = { description: op.description || '', props: op.props || [] }
  if (op.displayProp) schema.displayProp = op.displayProp
  if (op.prefix) schema.idgen = { prefix: op.prefix }
  return schema
}

// DDL verb → atomic engine method. The engine has no switch; the wire translates.
const EDIT_DISPATCH = {
  [SCHEMA_EDIT.CREATE]:           (s, name, op) => s.create(name, schemaFromCreateOp(op)),
  [SCHEMA_EDIT.DELETE]:           (s, name, op) => s.delete(name, { force: op.force }).then(r => ({ name, deleted: true, cleared: r.cleared })),
  [SCHEMA_EDIT.SET_DESCRIPTION]:  (s, name, op) => s.setDescription(name, op.value),
  [SCHEMA_EDIT.SET_DISPLAY_PROP]: (s, name, op) => s.setDisplayProp(name, op.value ?? ''),
  [SCHEMA_EDIT.SET_IDGEN]:        (s, name, op) => s.setIdgen(name, op.prefix ?? op.value),
  [SCHEMA_EDIT.ADD_FIELD]:        (s, name, op) => s.addField(name, op.field),
  [SCHEMA_EDIT.REMOVE_FIELD]:     (s, name, op) => s.removeField(name, op.key),
  [SCHEMA_EDIT.UPDATE_FIELD]:     (s, name, op) => s.updateField(name, op.key, op.changes || op.field || {}),
  [SCHEMA_EDIT.RENAME_FIELD]:     (s, name, op) => s.renameField(name, op.key, op.to),
}

function schemaEdit (p) {
  const op = p.op || {}
  const fn = EDIT_DISPATCH[op.op]
  if (!fn) {
    throw new ErrorGeneric(ERR.BAD_REQUEST, `Unknown schema op "${ op.op }". Allowed: ${ Object.values(SCHEMA_EDIT).join(', ') }.`)
  }
  return fn(_db.schemas, p.name, op)
}

const HANDLERS = {
  [RPC.SCHEMA_LIST]: ()  => _db.schemas.list(),
  [RPC.SCHEMA_GET]:  (p) => _db.schemas.get(p.name),
  [RPC.SCHEMA_EDIT]: (p) => schemaEdit(p),

  [RPC.COLLECTION_LIST]:   (p) => _db.collection(p.collection).list(p),
  [RPC.COLLECTION_GET]:    (p) => _db.collection(p.collection).get(p.id),
  [RPC.COLLECTION_CREATE]:      (p) => _db.collection(p.collection).create(p.data),
  [RPC.COLLECTION_CREATE_MANY]: (p) => _db.collection(p.collection).createMany(p.rows),
  [RPC.COLLECTION_UPDATE]:      (p) => _db.collection(p.collection).update(p.id, p.data),
  [RPC.COLLECTION_DELETE]:      (p) => _db.collection(p.collection).delete(p.id, { force: p.force }),
  [RPC.COLLECTION_DELETE_MANY]: (p) => _db.collection(p.collection).deleteMany(p.ids, { force: p.force }),
}

async function init (config) {
  const dataDir = join(config.system.vaultPath, '.brain-thing', 'db')
  mkdirSync(dataDir, { recursive: true })

  if (_db) await _db.close()
  _db = new Dataset(dataDir)
  await _db.open()

  _db.when.itemCreated  (payload => eventSink.emit({ kind: EVENT.ITEM_CREATED,   payload }))
  _db.when.itemUpdated  (payload => eventSink.emit({ kind: EVENT.ITEM_UPDATED,   payload }))
  _db.when.itemDeleted  (payload => eventSink.emit({ kind: EVENT.ITEM_DELETED,   payload }))
  _db.when.schemaCreated(payload => eventSink.emit({ kind: EVENT.SCHEMA_CREATED, payload }))
  _db.when.schemaUpdated(payload => eventSink.emit({ kind: EVENT.SCHEMA_UPDATED, payload }))
  _db.when.schemaDeleted(payload => eventSink.emit({ kind: EVENT.SCHEMA_DELETED, payload }))

  bus.info('init', `${ _db._entries.size } collection(s) @ ${ dataDir }`)
  ready.emit(true)
}

async function close () {
  if (!_db) return
  await _db.close()
  _db = null
  ready.forget()
}

async function call (name, payload) {
  if (!_db) {
    const err = new Error('Dataset not initialized')
    err.code = 'SERVICE_UNAVAILABLE'
    throw err
  }
  const fn = HANDLERS[name]
  if (!fn) {
    const err = new Error(`Unknown RPC "${ name }"`)
    err.code = 'NOT_FOUND'
    throw err
  }
  return await fn(payload || {})
}

function on (cb) { return eventSink.on(cb) }

export const dataset = { ready, init, close, call, on }
