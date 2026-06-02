import { dirname }                 from 'path'
import { fileURLToPath }           from 'url'
import crypto                      from 'node:crypto'
import Fastify                     from 'fastify'
import { cfg }                     from './config.js'
import { STATUS }                  from '../shared/status.js'
import { createBus }               from './lib/bus.js'
import { store }                   from './modules/store.js'
import { embeddings }              from './modules/embeddings.js'
import { obsidian }                from './modules/obsidian.js'
import { watcher }                 from './modules/watcher.js'
import { registration }            from './modules/register.js'
import { diagnostics }             from './modules/diagnostics.js'
import { tts }                     from './modules/tts.js'
import { dataset }                 from './dataset/index.js'
import { wrap }                    from './lib/api.js'
import { clearSeenHashes }         from './tools/_helpers.js'
import { SPECS }                   from './specs.js'

import { handle as get }            from './tools/get.js'
import { handle as what_is }        from './tools/what_is.js'
import { handle as grep }           from './tools/grep.js'
import { handle as look_around }    from './tools/look_around.js'
import { handle as tags_list }      from './tools/tags_list.js'
import { handle as create }         from './tools/create.js'
import { handle as edit }           from './tools/edit.js'
import { handle as del }            from './tools/delete.js'
import { handle as rename }         from './tools/rename.js'
import { handle as attributes }     from './tools/attributes.js'
import { handle as search }         from './tools/search.js'
import { handle as diagnostic }     from './tools/diagnostic.js'
import { handle as project_config } from './tools/project_config.js'
import { handle as long_read }      from './tools/long_read.js'
import { handle as db_schema }        from './tools/db_schema.js'
import { handle as db_schema_edit }   from './tools/db_schema_edit.js'
import { handle as db_query }         from './tools/db_query.js'
import { handle as db_get }           from './tools/db_get.js'
import { handle as db_create }        from './tools/db_create.js'
import { handle as db_create_many }   from './tools/db_create_many.js'
import { handle as db_update }        from './tools/db_update.js'
import { handle as db_delete }        from './tools/db_delete.js'
import { handle as db_delete_many }   from './tools/db_delete_many.js'

const HANDLERS = {
  get, what_is, grep, look_around, tags_list,
  create, edit, delete: del, rename,
  attributes, search, diagnostic, project_config, long_read,
  db_schema, db_schema_edit, db_query, db_get, db_create, db_create_many, db_update, db_delete, db_delete_many,
}

const TOOL_REGISTRY = SPECS.map(spec => {
  const handle = HANDLERS[spec.name]
  if (!handle) throw new Error(`Missing handler for tool "${ spec.name }" — add it in server.js HANDLERS map`)
  return { spec, handle }
})

const bus = createBus('brain')

const SKIP_ATTRIBUTES = new Set(['name', 'content', 'source_file', 'content_hash'])

/** Short signature of the per-tool enable/disable map — lets the MCP proxy detect changes. */
function toolsRev () {
  return crypto.createHash('sha1').update(JSON.stringify(cfg.state.vault.tools || {})).digest('hex').slice(0, 12)
}

let _changeCallback = null

function pushEntries () {
  if (server.onEntries) server.onEntries(store.entries.size)
}

function pushIssues () {
  let summary = 0, links = 0
  for (const entry of store.entries) {
    if (entry.issues.has('summary')) summary++
    if (entry.issues.has('links')) links++
  }
  if (server.onIssues) server.onIssues({ summary, links })
}

function pushAttributes () {
  const counts = {}
  for (const entry of store.entries) {
    for (const [key, value] of Object.entries(entry)) {
      if (SKIP_ATTRIBUTES.has(key)) continue
      if (value == null) continue
      if (Array.isArray(value) && value.length === 0) continue
      counts[key] = (counts[key] || 0) + 1
    }
  }
  if (server.onAttributes) server.onAttributes(counts)
}

function pushProjects () {
  if (!server.onProjects) return
  const counts = {}
  let noProject = 0
  for (const entry of store.entries) {
    if (entry.project) counts[entry.project] = (counts[entry.project] || 0) + 1
    else noProject++
  }
  server.onProjects({ projects: counts, noProject })
}

function status (phase, extra) {
  if (server.onStatus) server.onStatus(extra ? { phase, ...extra } : { phase })
}

let liveTimer = null

function startLiveCounter () {
  stopLiveCounter()
  liveTimer = setInterval(() => {
    if (server.onLiveCount) server.onLiveCount(store.entries.size)
  }, 150)
}

function stopLiveCounter () {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null }
}

async function start (dataDir, opts = {}) {
  if (dataDir) {
    cfg.init(dataDir)
    if (!cfg.state.system.brainDir) cfg.state.system.brainDir = dirname(fileURLToPath(import.meta.url))
  }

  const config = cfg.state

  if (!config.system.vaultPath) {
    bus.warn('start', 'No vault path configured, server not started')
    return null
  }

  process.env.TRANSFORMERS_CACHE = config.system.modelCacheDir

  store.init(config)
  obsidian.init(config)

  const fastify = Fastify({ logger: false })

  // Tag every response with the current tool-toggle signature so the MCP proxy can
  // detect changes and fire tools/list_changed.
  fastify.addHook('onSend', (req, reply, payload, done) => {
    reply.header('X-Tools-Rev', toolsRev())
    done(null, payload)
  })

  for (const t of TOOL_REGISTRY) {
    const name = t.spec.name
    fastify.post(`/${ name }`, wrap(name, (body) => {
      if (config.vault.tools?.[name] === false) {
        return { text: `Tool "${ name }" is disabled. Enable it in Settings → Tools.` }
      }
      return t.handle(body)
    }))
  }

  fastify.get('/status', async () => ({ name: config.system.name, entries: store.entries.size, vault: config.system.vaultPath }))
  fastify.get('/tools', async () => TOOL_REGISTRY.map(t => ({
    ...t.spec,
    enabled: config.vault.tools?.[t.spec.name] !== false,
  })))

  _changeCallback = async (filePaths) => {
    await obsidian.syncFiles(filePaths)
    diagnostics.checkChanged(filePaths)
    tts.onFilesChanged(filePaths)
    pushEntries()
    pushIssues()
    pushAttributes()
    pushProjects()
  }

  try {
    status(STATUS.STARTUP)
    await registration.register(config)

    status(STATUS.DOWNLOADING)
    embeddings.onProgress = (data) => {
      if (data.status === 'progress' && data.progress != null) {
        status(STATUS.DOWNLOADING, { progress: Math.round(data.progress), file: data.file })
      }
    }
    await embeddings.init(config)
    embeddings.onProgress = null

    status(STATUS.SCANNING)
    startLiveCounter()
    await obsidian.run()
    stopLiveCounter()

    status(STATUS.INDEXING)
    await store.entries.ensureVectors()
    await embeddings.cleanup()

    status(STATUS.READY)
    diagnostics.checkAll()
    watcher.start(config, _changeCallback)
    tts.init(config)
    await dataset.init(config)

    const onConfigChanged = (scope) => () => {
      pushProjects()
      if (server.onConfigChanged) server.onConfigChanged(scope)
    }
    cfg.system.changed.on(onConfigChanged('system'))
    cfg.vault.changed.on(onConfigChanged('vault'))

    store.ready.emit()

    pushEntries()
    pushIssues()
    pushAttributes()
    pushProjects()

    if (!opts.skipListen) {
      await fastify.listen({ port: config.system.apiPort, host: config.const.api.host })
      bus.info('start', `Ready: ${ store.entries.size } entries @ http://${ config.const.api.host }:${ config.system.apiPort }`)
    } else {
      await fastify.ready()
      bus.info('start', `Ready: ${ store.entries.size } entries (listen skipped)`)
    }

    return fastify
  } catch (err) {
    stopLiveCounter()
    bus.error('start', err.message)
    status(STATUS.ERROR, { message: err.message })
    store.ready.emit({ error: err.message })
    return null
  }
}

async function hotSwap () {
  if (!store.entries) return start()

  const config = cfg.state
  bus.info('swap', `Hot-swapping vault to ${ config.system.vaultPath }`)

  store.ready.forget()
  watcher.stop()
  store.entries.clear()
  clearSeenHashes()

  try {
    status(STATUS.REINDEXING)
    startLiveCounter()
    await obsidian.run()
    stopLiveCounter()

    status(STATUS.INDEXING)
    await store.entries.ensureVectors()
    await embeddings.cleanup()

    status(STATUS.READY)
    diagnostics.checkAll()
    watcher.start(config, _changeCallback)

    store.ready.emit()

    pushEntries()
    pushIssues()
    pushAttributes()
    pushProjects()

    await tts.reload()
    await dataset.init(config)

    if (server.onConfigChanged) server.onConfigChanged()

    bus.info('swap', `Complete: ${ store.entries.size } entries`)
  } catch (err) {
    stopLiveCounter()
    bus.error('swap', err.message)
    status(STATUS.ERROR, { message: err.message })
    store.ready.emit({ error: err.message })
  }
}

export const server = {
  start,
  hotSwap,
  onStatus: null,
  onEntries: null,
  onIssues: null,
  onAttributes: null,
  onProjects: null,
  onLiveCount: null,
  onConfigChanged: null,
}
