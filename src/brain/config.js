import { join }                                                                  from 'path'
import { existsSync, mkdirSync, readFileSync, unlinkSync, watch, writeFileSync } from 'fs'
import crypto                                                                    from 'node:crypto'
import Signal                                                                    from 'a-signal'
import { FIELD }                                                                 from './lib/field-types.js'
import { APP_NAME, TOOLS }                                                       from '../shared/constants.js'
import { createBus }                                                             from './lib/bus.js'
import { deepClone, deepFreeze }                                                 from './lib/utils.js'

export { TOOLS }

const bus = createBus('config', { system: true })

const BRAIN_DIR = '.brain-thing'

const CORE_FIELD_NAMES = new Set(['project', 'tags', 'created', 'modified', 'summary'])
const TYPE_MAP = { string: FIELD.STRING, date: FIELD.DATE, number: FIELD.NUMBER, list: FIELD.LIST }

/** Keys that lived in app config before v4 migration but belong to vault settings */
const VAULT_MIGRATION_KEYS = ['fields', 'ignore', 'organize', 'features', 'guidelineName']

/** Allowlists for public set() API */
const SYSTEM_KEYS = new Set(['v', 'vaultPath', 'startMinimized', 'verboseConsole', 'windowBounds', 'name'])
const VAULT_KEYS  = new Set(['guidelineName', 'features', 'fields', 'ignore', 'organize'])

/** Hardcoded values — no UI, no external override */
export const CONSTANTS = deepFreeze({
  api: { port: 43000, host: '127.0.0.1' },
  tts: { port: 42033, host: '127.0.0.1' },
  embeddings: { model: 'Xenova/multilingual-e5-large', dimensions: 1024 },
  skipLinkScan: ['tags', 'state', 'status', 'narrate'],
  frontmatterHead: ['name', 'project', 'tags'],
  frontmatterTail: ['created', 'modified', 'summary'],
})

const SYSTEM_DEFAULTS = {
  v: 4,
  vaultPath: '',
  startMinimized: false,
  verboseConsole: false,
  // name: MCP identifier key in Claude's mcpServers config.
  // Kept in system state (not constants) — UI for rename is planned, per-install value.
  name: APP_NAME,
  windowBounds: null,
}

const VAULT_DEFAULTS = {
  guidelineName: 'HOME',
  features: { tts: false },
  ignore: {
    folders: ['Sec', '_etc', 'Assets', 'Log', 'Templates'],
    patterns: ['excalidraw'],
  },
  organize: {
    useOrganize: false,
    default: 'Input',
    projects: {
      MP: {
        folder: 'My Project',
        rules: [
          { tag: 'mp/doc', folder: 'Docs' },
          { tag: 'mp/task', folder: 'Tasks' },
          { field: 'status', value: 'done', folder: 'Archive' },
        ],
      },
    },
    rules: [
      { tag: 'my/log', folder: 'Logs' },
    ],
  },
  fields: [
    { name: 'project',  type: 'string', desc: 'Project grouping',                       core: true },
    { name: 'tags',     type: 'list',   desc: 'Hierarchical categorization',            core: true },
    { name: 'created',  type: 'date',   desc: 'Auto-set on creation',                   core: true },
    { name: 'modified', type: 'date',   desc: 'Auto-updated on every write',            core: true },
    { name: 'summary',  type: 'string', desc: 'Brief description for semantic indexing', core: true },
    { name: 'aliases',  type: 'list',   desc: 'Alternative names' },
    { name: 'status',   type: 'string', desc: 'Free-form status' },
    { name: 'priority', type: 'number', desc: 'Priority level' },
    { name: 'due',      type: 'date',   desc: 'Deadline' },
    { name: 'state',    type: 'string', desc: 'Document maturity' },
    { name: 'narrate',  type: 'string', desc: 'TTS collection name', feature: 'tts' },
  ],
}

// --- Runtime states ---

const systemState = {
  vaultPath: '',
  startMinimized: false,
  verboseConsole: false,
  name: APP_NAME,
  windowBounds: null,
  dataDir: null,
  resourcesPath: null,
  brainDir: null,
  modelCacheDir: null,
}

const vaultState = {
  guidelineName: VAULT_DEFAULTS.guidelineName,
  features: deepClone(VAULT_DEFAULTS.features),
  ignore: deepClone(VAULT_DEFAULTS.ignore),
  organize: deepClone(VAULT_DEFAULTS.organize),
  fields: buildFields(VAULT_DEFAULTS.fields),
  vectorCacheDir: null,
}

const state = {
  system: systemState,
  vault: vaultState,
  const: CONSTANTS,
}

// --- Signals ---

const ready = new Signal({ late: true, memorable: true })
const systemChanged = new Signal()
const vaultChanged = new Signal()

// --- Module-level paths & watcher state ---

let systemPath = null
let vaultFilePath = null
let settingsWatcher = null
let lastSettingsHash = null
let settingsDebounce = null

// --- Helpers ---

function loadJSON (filePath) {
  if (!filePath) return {}
  try { return JSON.parse(readFileSync(filePath, 'utf-8')) } catch { return {} }
}

function saveJSON (filePath, data) {
  if (!filePath) return
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function hashStr (str) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

function ensureBrainDir (vaultDir) {
  if (!vaultDir) return
  const dir = join(vaultDir, BRAIN_DIR)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function buildFields (arr = []) {
  const fields = {
    project: FIELD.STRING.describe('Project grouping'),
    tags: FIELD.LIST.describe('Hierarchical categorization'),
    created: FIELD.DATE.describe('Auto-set on creation'),
    modified: FIELD.DATE.describe('Auto-updated on every write'),
    summary: FIELD.STRING.describe('Brief description for semantic indexing'),
  }
  for (const def of arr) {
    const base = TYPE_MAP[def.type] || FIELD.STRING
    const field = base.describe(def.desc || '')
    if (def.feature) field.feature = def.feature
    fields[def.name] = field
  }
  return fields
}

// --- Migration (system config only) ---

function isDefaultConstant (key, value) {
  const def = CONSTANTS[key]
  if (Array.isArray(def)) {
    return Array.isArray(value) && value.length === def.length && value.every((x, i) => x === def[i])
  }
  if (key === 'api' || key === 'tts') {
    return value && value.port === def.port && value.host === def.host
  }
  if (key === 'embeddings') {
    return value && value.model === def.model && value.dimensions === def.dimensions
  }
  return true
}

function migrateSystemConfig (stored) {
  let changed = false
  // v1 → v2: organize.scopes → organize.projects (legacy — only if organize still lives here)
  if (!stored.v || stored.v < 2) {
    if (stored.organize?.scopes) {
      const projects = {}
      for (const scope of stored.organize.scopes) {
        if (scope.name && scope.folder) projects[scope.name] = scope.folder
      }
      stored.organize.projects = projects
      stored.organize.rules = stored.organize.noScopeRules || []
      delete stored.organize.scopes
      delete stored.organize.noScopeRules
    }
    stored.v = 2
    changed = true
  }
  // v2 → v3: flat project folder → { folder, rules }
  if (stored.v < 3) {
    if (stored.organize?.projects) {
      for (const [key, val] of Object.entries(stored.organize.projects)) {
        if (typeof val === 'string') {
          stored.organize.projects[key] = { folder: val, rules: [] }
        }
      }
    }
    stored.v = 3
    changed = true
  }
  // v3 → v4: drop now-constant keys, relocate vault keys to settings.json, drop legacy sentinel
  if (stored.v < 4) {
    for (const key of ['api', 'tts', 'embeddings', 'skipLinkScan', 'frontmatterHead', 'frontmatterTail']) {
      if (key in stored) {
        if (!isDefaultConstant(key, stored[key])) {
          bus.warn('migrate', `${ key } override ${ JSON.stringify(stored[key]) } discarded — now a constant`)
        }
        delete stored[key]
        changed = true
      }
    }
    // Relocate any vault keys still sitting in app config to the vault's settings.json
    if (stored.vaultPath) {
      const legacyVaultFile = join(stored.vaultPath, BRAIN_DIR, 'settings.json')
      if (!existsSync(legacyVaultFile)) {
        try {
          ensureBrainDir(stored.vaultPath)
          const vaultData = { ...VAULT_DEFAULTS }
          for (const key of VAULT_MIGRATION_KEYS) {
            if (key in stored) vaultData[key] = stored[key]
          }
          saveJSON(legacyVaultFile, vaultData)
        } catch (err) {
          bus.warn('migrate', `vault key relocation failed: ${ err.message }`)
        }
      }
    }
    for (const key of VAULT_MIGRATION_KEYS) {
      if (key in stored) { delete stored[key]; changed = true }
    }
    if ('_settingsMigrated' in stored) {
      delete stored._settingsMigrated
      changed = true
    }
    stored.v = 4
    changed = true
  }
  if (changed) saveJSON(systemPath, stored)
  return stored
}

/** Seed settings.json with defaults if it doesn't exist. Legacy relocation happens in v3→v4 migration. */
function ensureSettingsFile () {
  if (!vaultFilePath || existsSync(vaultFilePath)) return
  saveJSON(vaultFilePath, { ...VAULT_DEFAULTS })
}

function loadVaultFile () {
  return loadJSON(vaultFilePath)
}

function saveVaultFile (data) {
  saveJSON(vaultFilePath, data)
  try { lastSettingsHash = hashStr(readFileSync(vaultFilePath, 'utf-8')) } catch { /* ignore */ }
}

// --- Apply ---

function applySystemConfig () {
  const stored = migrateSystemConfig(loadJSON(systemPath))
  const merged = { ...SYSTEM_DEFAULTS, ...stored }

  systemState.vaultPath = merged.vaultPath
  systemState.startMinimized = merged.startMinimized
  systemState.verboseConsole = merged.verboseConsole
  systemState.name = merged.name
  systemState.windowBounds = merged.windowBounds || null

  if (systemState.dataDir) {
    systemState.modelCacheDir = join(systemState.dataDir, 'models')
  }
}

function applyVaultConfig () {
  if (!systemState.vaultPath) {
    vaultFilePath = null
    vaultState.guidelineName = VAULT_DEFAULTS.guidelineName
    vaultState.features = deepClone(VAULT_DEFAULTS.features)
    vaultState.ignore = deepClone(VAULT_DEFAULTS.ignore)
    vaultState.organize = deepClone(VAULT_DEFAULTS.organize)
    vaultState.fields = buildFields(VAULT_DEFAULTS.fields)
    vaultState.vectorCacheDir = null
    lastSettingsHash = null
    return
  }
  ensureBrainDir(systemState.vaultPath)
  vaultFilePath = join(systemState.vaultPath, BRAIN_DIR, 'settings.json')

  ensureSettingsFile()

  const stored = loadVaultFile()
  const merged = { ...VAULT_DEFAULTS, ...stored }

  if (Array.isArray(merged.fields)) {
    for (const f of merged.fields) f.core = CORE_FIELD_NAMES.has(f.name) || false
  }

  vaultState.guidelineName = merged.guidelineName
  vaultState.features = deepClone(merged.features)
  vaultState.ignore = deepClone(merged.ignore)
  vaultState.organize = deepClone(merged.organize)
  vaultState.fields = buildFields(merged.fields)
  vaultState.vectorCacheDir = join(systemState.vaultPath, BRAIN_DIR, 'vector-cache')

  try { lastSettingsHash = hashStr(readFileSync(vaultFilePath, 'utf-8')) } catch { /* ignore */ }
}

// --- External settings watcher ---

function stopSettingsWatcher () {
  if (settingsWatcher) { settingsWatcher.close(); settingsWatcher = null }
  if (settingsDebounce) { clearTimeout(settingsDebounce); settingsDebounce = null }
}

function startSettingsWatcher () {
  stopSettingsWatcher()
  if (!systemState.vaultPath) return

  const watchDir = join(systemState.vaultPath, BRAIN_DIR)
  if (!existsSync(watchDir)) return

  try {
    settingsWatcher = watch(watchDir, (_, filename) => {
      if (filename !== 'settings.json') return
      if (settingsDebounce) clearTimeout(settingsDebounce)
      settingsDebounce = setTimeout(() => {
        try {
          const raw = readFileSync(vaultFilePath, 'utf-8')
          const hash = hashStr(raw)
          if (hash === lastSettingsHash) return
          lastSettingsHash = hash
          applyVaultConfig()
          vaultChanged.emit(state)
        } catch { /* file gone or unreadable */ }
      }, 500)
    })
  } catch { /* dir unavailable */ }
}

// --- System API ---

function filterPatch (patch, allowed, scope) {
  const out = {}
  for (const [k, v] of Object.entries(patch)) {
    if (allowed.has(k)) out[k] = v
    else bus.warn('set', `${ scope }: unknown key "${ k }" dropped`)
  }
  return out
}

function systemGet () {
  const stored = loadJSON(systemPath)
  return { ...SYSTEM_DEFAULTS, ...stored }
}

function systemSet (patch) {
  const filtered = filterPatch(patch, SYSTEM_KEYS, 'system')
  if (Object.keys(filtered).length === 0) return
  const prevVaultPath = systemState.vaultPath
  const current = loadJSON(systemPath)
  saveJSON(systemPath, { ...SYSTEM_DEFAULTS, ...current, ...filtered })
  applySystemConfig()
  systemChanged.emit(state)
  if (systemState.vaultPath !== prevVaultPath) {
    applyVaultConfig()
    startSettingsWatcher()
    vaultChanged.emit(state)
  }
}

function systemReset () {
  if (systemPath && existsSync(systemPath)) unlinkSync(systemPath)
  const prevVaultPath = systemState.vaultPath
  applySystemConfig()
  systemChanged.emit(state)
  if (systemState.vaultPath !== prevVaultPath) {
    stopSettingsWatcher()
    applyVaultConfig()
    vaultChanged.emit(state)
  }
}

// --- Vault API ---

function vaultGet () {
  const stored = loadVaultFile()
  const merged = { ...VAULT_DEFAULTS, ...stored }
  if (Array.isArray(merged.fields)) {
    for (const f of merged.fields) f.core = CORE_FIELD_NAMES.has(f.name) || false
  }
  return merged
}

function vaultSet (patch) {
  if (!vaultFilePath) return
  const filtered = filterPatch(patch, VAULT_KEYS, 'vault')
  if (Object.keys(filtered).length === 0) return
  const current = loadVaultFile()
  saveVaultFile({ ...VAULT_DEFAULTS, ...current, ...filtered })
  applyVaultConfig()
  vaultChanged.emit(state)
}

function vaultReset () {
  if (vaultFilePath && existsSync(vaultFilePath)) unlinkSync(vaultFilePath)
  applyVaultConfig()
  vaultChanged.emit(state)
}

// --- Init ---

function init (dataDir) {
  systemState.dataDir = dataDir
  systemPath = join(dataDir, 'config.json')
  applySystemConfig()
  applyVaultConfig()
  startSettingsWatcher()
  ready.emit(state)
}

function getPath (scope) {
  if (scope === 'system') return systemPath
  if (scope === 'vault') return vaultFilePath
  return { system: systemPath, vault: vaultFilePath }
}

export const cfg = {
  state,
  ready,
  init,
  getPath,
  system: { get: systemGet, set: systemSet, reset: systemReset, changed: systemChanged },
  vault:  { get: vaultGet,  set: vaultSet,  reset: vaultReset,  changed: vaultChanged },
}
