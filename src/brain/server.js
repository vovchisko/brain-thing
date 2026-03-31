import { dirname }                 from 'path'
import { fileURLToPath }           from 'url'
import { config, init, TOOLS }     from './config.js'
import { createBus }               from './lib/bus.js'

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
import * as mcpDiagnostic from './mcp/diagnostic.js'

const ALL_MCP = [
  mcpGet, mcpWhatIs, mcpGrep, mcpLookAround, mcpTagsList,
  mcpCreate, mcpUpdate, mcpReplace, mcpInsert, mcpDelete, mcpRename,
  mcpFields, mcpSearch, mcpNarrate, mcpDiagnostic,
]

const bus = createBus('brain')

export const server = {
  onStatus: null,
  onEntries: null,
  onIssues: null,
  onFields: null,
  onProjects: null,
  onLiveCount: null,
}

const SKIP_FIELDS = new Set(['name', 'content', 'source_file', 'content_hash'])

let _store, _obsidian, _watcher, _embeddings, _diagnostics, _tts, _fastify, _changeCallback

function pushEntries () {
  if (server.onEntries) server.onEntries(_store.entries.size)
}

function pushIssues () {
  let summary = 0, links = 0
  for (const entry of _store.entries) {
    if (entry.issues.has('summary')) summary++
    if (entry.issues.has('links')) links++
  }
  if (server.onIssues) server.onIssues({ summary, links })
}

function pushFields () {
  const counts = {}
  for (const entry of _store.entries) {
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
  if (!server.onProjects || !_store) return
  const counts = {}
  let noProject = 0
  for (const entry of _store.entries) {
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
    if (server.onLiveCount) server.onLiveCount(_store.entries.size)
  }, 150)
}

function stopLiveCounter () {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null }
}

export async function start (dataDir) {
  if (dataDir) {
    init(dataDir)
    if (!config.brainDir) config.brainDir = dirname(fileURLToPath(import.meta.url))
  }
  if (!config.vault) {
    bus.warn('start', 'No vault path configured, server not started')
    return null
  }

  process.env.TRANSFORMERS_CACHE = config.modelCacheDir

  const { default: Fastify } = await import('fastify')
  const { store }            = await import('./modules/store.js')
  const { embeddings }       = await import('./modules/embeddings.js')
  const { obsidian }         = await import('./modules/obsidian.js')
  const { watcher }          = await import('./modules/watcher.js')
  const { register }         = await import('./modules/register.js')
  const { diagnostics }      = await import('./modules/diagnostics.js')
  const { tts }              = await import('./modules/tts.js')
  const { wrap }             = await import('./lib/api.js')

  const { handleGet }        = await import('./api/get.js')
  const { handleWhatIs }     = await import('./api/what_is.js')
  const { handleTagsList }   = await import('./api/tags_list.js')
  const { handleCreate }     = await import('./api/create.js')
  const { handleUpdate }     = await import('./api/update.js')
  const { handleReplace }    = await import('./api/replace.js')
  const { handleInsert }     = await import('./api/insert.js')
  const { handleDelete }     = await import('./api/delete.js')
  const { handleRename }     = await import('./api/rename.js')
  const { handleGrep }       = await import('./api/grep.js')
  const { handleNarrate }    = await import('./api/narrate.js')
  const { handleLookAround } = await import('./api/look_around.js')
  const { handleFields }     = await import('./api/fields.js')
  const { handleSearch }     = await import('./api/search.js')
  const { handleDiagnostic } = await import('./api/diagnostic.js')

  _store = store
  _obsidian = obsidian
  _watcher = watcher
  _embeddings = embeddings
  _diagnostics = diagnostics
  _tts = tts

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
  await register()

  status('downloading-embedding')
  embeddings.onProgress = (data) => {
    if (data.status === 'progress' && data.progress != null) {
      status('downloading-embedding', { progress: Math.round(data.progress), file: data.file })
    }
  }
  await embeddings.init()
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
  watcher.start(_changeCallback)
  if (config.features.tts) tts.init()

  store.ready.emit()

  pushEntries()
  pushIssues()
  pushFields()
  pushProjects()

  await fastify.listen({ port: config.api.port, host: config.api.host })
  bus.info('start', `Ready: ${ store.entries.size } entries @ http://${ config.api.host }:${ config.api.port }`)

  return fastify
}

export async function hotSwap () {
  if (!_store) return start()

  // Re-read config (already applied by setConfig)
  bus.info('swap', `Hot-swapping vault to ${ config.vault }`)

  _store.ready.forget()
  _watcher.stop()
  _store.entries.clear()

  status('re-indexing')
  startLiveCounter()
  await _obsidian.run()
  stopLiveCounter()

  status('indexing')
  await _store.entries.ensureVectors()
  await _embeddings.cleanup()

  status('ready')
  _diagnostics.checkAll()
  _watcher.start(_changeCallback)

  _store.ready.emit()

  pushEntries()
  pushIssues()
  pushFields()
  pushProjects()

  bus.info('swap', `Complete: ${ _store.entries.size } entries`)
}
