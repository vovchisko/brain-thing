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
import { describeFields }          from './lib/utils.js'

import * as toolGet           from './tools/get.js'
import * as toolWhatIs        from './tools/what_is.js'
import * as toolGrep          from './tools/grep.js'
import * as toolLookAround    from './tools/look_around.js'
import * as toolTagsList      from './tools/tags_list.js'
import * as toolCreate        from './tools/create.js'
import * as toolUpdate        from './tools/update.js'
import * as toolReplace       from './tools/replace.js'
import * as toolInsert        from './tools/insert.js'
import * as toolDelete        from './tools/delete.js'
import * as toolRename        from './tools/rename.js'
import * as toolFields        from './tools/fields.js'
import * as toolSearch        from './tools/search.js'
import * as toolDiagnostic    from './tools/diagnostic.js'
import * as toolProjectConfig from './tools/project_config.js'
import * as toolLongRead      from './tools/long_read.js'

const ALL_TOOLS = [
  toolGet, toolWhatIs, toolGrep, toolLookAround, toolTagsList,
  toolCreate, toolUpdate, toolReplace, toolInsert, toolDelete, toolRename,
  toolFields, toolSearch, toolDiagnostic, toolProjectConfig, toolLongRead,
]

const bus = createBus('brain')

function isEnabled (t, config) {
  return !t.feature || config.vault.features[t.feature]
}

function augmentDescription (t, config) {
  if (!t.injectFields) return t.tool
  const block = describeFields(config, t.injectFields)
  if (!block) return t.tool
  const header = t.injectFields === 'search' ? 'Searchable fields' : 'Known fields'
  const tail = `\n\n${ header } (configure in Settings → Fields):\n${ block }`
  return { ...t.tool, description: t.tool.description + tail }
}

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
  _fastify = fastify

  fastify.post(`/${ toolGet.tool.name }`,           wrap(toolGet.tool.name,           toolGet.handle))
  fastify.post(`/${ toolWhatIs.tool.name }`,        wrap(toolWhatIs.tool.name,        toolWhatIs.handle))
  fastify.post(`/${ toolGrep.tool.name }`,          wrap(toolGrep.tool.name,          toolGrep.handle))
  fastify.post(`/${ toolLookAround.tool.name }`,    wrap(toolLookAround.tool.name,    toolLookAround.handle))
  fastify.post(`/${ toolTagsList.tool.name }`,      wrap(toolTagsList.tool.name,      toolTagsList.handle))
  fastify.post(`/${ toolCreate.tool.name }`,        wrap(toolCreate.tool.name,        toolCreate.handle))
  fastify.post(`/${ toolUpdate.tool.name }`,        wrap(toolUpdate.tool.name,        toolUpdate.handle))
  fastify.post(`/${ toolReplace.tool.name }`,       wrap(toolReplace.tool.name,       toolReplace.handle))
  fastify.post(`/${ toolInsert.tool.name }`,        wrap(toolInsert.tool.name,        toolInsert.handle))
  fastify.post(`/${ toolDelete.tool.name }`,        wrap(toolDelete.tool.name,        toolDelete.handle))
  fastify.post(`/${ toolRename.tool.name }`,        wrap(toolRename.tool.name,        toolRename.handle))
  fastify.post(`/${ toolFields.tool.name }`,        wrap(toolFields.tool.name,        toolFields.handle))
  fastify.post(`/${ toolSearch.tool.name }`,        wrap(toolSearch.tool.name,        toolSearch.handle))
  fastify.post(`/${ toolDiagnostic.tool.name }`,    wrap(toolDiagnostic.tool.name,    toolDiagnostic.handle))
  fastify.post(`/${ toolProjectConfig.tool.name }`, wrap(toolProjectConfig.tool.name, toolProjectConfig.handle))
  fastify.post(`/${ toolLongRead.tool.name }`,      wrap(toolLongRead.tool.name,      toolLongRead.handle))

  fastify.get('/status', async () => ({ name: config.system.name, entries: store.entries.size, vault: config.system.vaultPath }))
  fastify.get('/tools', async () => {
    const tools = ALL_TOOLS
      .filter(t => isEnabled(t, config))
      .map(t => augmentDescription(t, config))
    bus.info(`MCP requested tools (${ tools.length })`)
    return tools
  })

  _changeCallback = async (filePaths) => {
    await obsidian.syncFiles(filePaths)
    diagnostics.checkChanged(filePaths)
    tts.onFilesChanged(filePaths)
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
  tts.init(config)

  const onConfigChanged = (scope) => () => {
    pushProjects()
    if (server.onConfigChanged) server.onConfigChanged(scope)
  }
  cfg.system.changed.on(onConfigChanged('system'))
  cfg.vault.changed.on(onConfigChanged('vault'))

  store.ready.emit()

  pushEntries()
  pushIssues()
  pushFields()
  pushProjects()

  if (!opts.skipListen) {
    await fastify.listen({ port: config.const.api.port, host: config.const.api.host })
    bus.info('start', `Ready: ${ store.entries.size } entries @ http://${ config.const.api.host }:${ config.const.api.port }`)
  } else {
    await fastify.ready()
    bus.info('start', `Ready: ${ store.entries.size } entries (listen skipped)`)
  }

  return fastify
}

async function hotSwap () {
  if (!store.entries) return start()

  const config = cfg.state
  bus.info('swap', `Hot-swapping vault to ${ config.system.vaultPath }`)

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
