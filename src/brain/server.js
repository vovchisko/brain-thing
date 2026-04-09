import { dirname }                 from 'path'
import { fileURLToPath }           from 'url'
import Fastify                     from 'fastify'
import { cfg, TOOLS }              from './config.js'
import { createBus }               from './lib/bus.js'
import { store }                   from './modules/store.js'
import { embeddings }              from './modules/embeddings.js'
import { obsidian }                from './modules/obsidian.js'
import { watcher }                 from './modules/watcher.js'
import { registration }            from './modules/register.js'
import { diagnostics }             from './modules/diagnostics.js'
import { tts }                     from './modules/tts.js'
import { wrap }                    from './lib/api.js'

import { handleGet }        from './api/get.js'
import { handleWhatIs }     from './api/what_is.js'
import { handleTagsList }   from './api/tags_list.js'
import { handleCreate }     from './api/create.js'
import { handleUpdate }     from './api/update.js'
import { handleReplace }    from './api/replace.js'
import { handleInsert }     from './api/insert.js'
import { handleDelete }     from './api/delete.js'
import { handleRename }     from './api/rename.js'
import { handleGrep }       from './api/grep.js'
import { handleNarrate }    from './api/narrate.js'
import { handleLookAround } from './api/look_around.js'
import { handleFields }     from './api/fields.js'
import { handleSearch }     from './api/search.js'
import { handleDiagnostic }     from './api/diagnostic.js'
import { handleProjectConfig } from './api/project_config.js'

import * as mcpGet        from './mcp/get.js'
import * as mcpWhatIs     from './mcp/what_is.js'
import * as mcpGrep       from './mcp/grep.js'
import * as mcpLookAround from './mcp/look_around.js'
import * as mcpTagsList   from './mcp/tags_list.js'
import * as mcpCreate     from './mcp/create.js'
import * as mcpUpdate     from './mcp/update.js'
import * as mcpReplace    from './mcp/replace.js'
import * as mcpInsert     from './mcp/insert.js'
import * as mcpDelete     from './mcp/delete.js'
import * as mcpRename     from './mcp/rename.js'
import * as mcpFields     from './mcp/fields.js'
import * as mcpSearch     from './mcp/search.js'
import * as mcpNarrate    from './mcp/narrate.js'
import * as mcpDiagnostic     from './mcp/diagnostic.js'
import * as mcpProjectConfig from './mcp/project_config.js'

const ALL_MCP = [
  mcpGet, mcpWhatIs, mcpGrep, mcpLookAround, mcpTagsList,
  mcpCreate, mcpUpdate, mcpReplace, mcpInsert, mcpDelete, mcpRename,
  mcpFields, mcpSearch, mcpNarrate, mcpDiagnostic, mcpProjectConfig,
]

const bus = createBus('brain')

const SKIP_FIELDS = new Set(['name', 'content', 'source_file', 'content_hash'])

let _fastify = null
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

function pushFields () {
  const counts = {}
  for (const entry of store.entries) {
    for (const [key, value] of Object.entries(entry)) {
      if (SKIP_FIELDS.has(key)) continue
      if (value == null) continue
      if (Array.isArray(value) && value.length === 0) continue
      counts[key] = (counts[key] || 0) + 1
    }
  }
  if (server.onFields) server.onFields(counts)
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

async function start (dataDir) {
  if (dataDir) {
    cfg.init(dataDir)
    if (!cfg.state.brainDir) cfg.state.brainDir = dirname(fileURLToPath(import.meta.url))
  }

  const config = cfg.state

  if (!config.vault) {
    bus.warn('start', 'No vault path configured, server not started')
    return null
  }

  process.env.TRANSFORMERS_CACHE = config.modelCacheDir

  store.init(config)
  obsidian.init(config)

  const fastify = Fastify({ logger: false })
  _fastify = fastify

  fastify.post(`/${ TOOLS.GET }`, wrap('get', handleGet))
  fastify.post(`/${ TOOLS.WHAT_IS }`, wrap('what_is', handleWhatIs))
  fastify.post(`/${ TOOLS.GREP }`, wrap('grep', handleGrep))
  fastify.post(`/${ TOOLS.LOOK_AROUND }`, wrap('look_around', handleLookAround))
  fastify.post(`/${ TOOLS.TAGS_LIST }`, wrap('tags_list', handleTagsList))
  fastify.post(`/${ TOOLS.CREATE }`, wrap('create', handleCreate))
  fastify.post(`/${ TOOLS.UPDATE }`, wrap('update', handleUpdate))
  fastify.post(`/${ TOOLS.REPLACE }`, wrap('replace', handleReplace))
  fastify.post(`/${ TOOLS.INSERT }`, wrap('insert', handleInsert))
  fastify.post(`/${ TOOLS.DELETE }`, wrap('delete', handleDelete))
  fastify.post(`/${ TOOLS.RENAME }`, wrap('rename', handleRename))
  fastify.post(`/${ TOOLS.FIELDS }`, wrap('fields', handleFields))
  fastify.post(`/${ TOOLS.SEARCH }`, wrap('search', handleSearch))
  if (config.features.tts) {
    fastify.post(`/${ TOOLS.NARRATE }`, wrap('narrate', handleNarrate))
  }
  fastify.post(`/${ TOOLS.DIAGNOSTIC }`, wrap('diagnostic', handleDiagnostic))
  fastify.post(`/${ TOOLS.PROJECT_CONFIG }`, wrap('project_config', handleProjectConfig))

  fastify.get('/status', async () => ({ name: config.name, entries: store.entries.size, vault: config.vault }))
  fastify.get('/tools', async () => {
    const tools = ALL_MCP.filter(m => !m.feature || config.features[m.feature]).map(m => m.tool)
    bus.info(`MCP requested tools (${ tools.length })`)
    return tools
  })

  _changeCallback = async (filePaths) => {
    await obsidian.syncFiles(filePaths)
    diagnostics.checkChanged(filePaths)
    if (config.features.tts) tts.onFilesChanged(filePaths)
    pushEntries()
    pushIssues()
    pushFields()
    pushProjects()
  }

  status('startup')
  await registration.register(config)

  status('downloading-embedding')
  embeddings.onProgress = (data) => {
    if (data.status === 'progress' && data.progress != null) {
      status('downloading-embedding', { progress: Math.round(data.progress), file: data.file })
    }
  }
  await embeddings.init(config)
  embeddings.onProgress = null

  status('scanning')
  startLiveCounter()
  await obsidian.run()
  stopLiveCounter()

  status('indexing')
  await store.entries.ensureVectors()
  await embeddings.cleanup()

  status('ready')
  diagnostics.checkAll()
  watcher.start(config, _changeCallback)
  if (config.features.tts) tts.init(config)

  cfg.changed.on(() => {
    pushProjects()
    if (server.onConfigChanged) server.onConfigChanged()
  })

  store.ready.emit()

  pushEntries()
  pushIssues()
  pushFields()
  pushProjects()

  await fastify.listen({ port: config.api.port, host: config.api.host })
  bus.info('start', `Ready: ${ store.entries.size } entries @ http://${ config.api.host }:${ config.api.port }`)

  return fastify
}

async function hotSwap () {
  if (!store.entries) return start()

  const config = cfg.state
  bus.info('swap', `Hot-swapping vault to ${ config.vault }`)

  store.ready.forget()
  watcher.stop()
  store.entries.clear()

  status('re-indexing')
  startLiveCounter()
  await obsidian.run()
  stopLiveCounter()

  status('indexing')
  await store.entries.ensureVectors()
  await embeddings.cleanup()

  status('ready')
  diagnostics.checkAll()
  watcher.start(config, _changeCallback)

  store.ready.emit()

  pushEntries()
  pushIssues()
  pushFields()
  pushProjects()

  if (server.onConfigChanged) server.onConfigChanged()

  bus.info('swap', `Complete: ${ store.entries.size } entries`)
}

export const server = {
  start,
  hotSwap,
  onStatus: null,
  onEntries: null,
  onIssues: null,
  onFields: null,
  onProjects: null,
  onLiveCount: null,
  onConfigChanged: null,
}
