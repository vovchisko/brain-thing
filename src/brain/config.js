import { join }                                                          from 'path'
import { existsSync, mkdirSync, readFileSync, unlinkSync, watch, writeFileSync } from 'fs'
import crypto                                                            from 'node:crypto'
import Signal                                                            from 'a-signal'
import { FIELD }                                                         from './lib/field-types.js'
import { APP_NAME, TOOLS }                                               from '../shared/constants.js'

export { TOOLS }

const CORE_FIELD_NAMES = new Set(['project', 'tags', 'created', 'modified', 'summary'])
const TYPE_MAP = { string: FIELD.STRING, date: FIELD.DATE, number: FIELD.NUMBER, list: FIELD.LIST }

const BRAIN_DIR = '.brain-thing'

/** Keys stored in vault settings (synced across machines) */
const VAULT_KEYS = new Set(['fields', 'ignore', 'organize', 'features', 'guidelineName'])

/**
 * App-level defaults — machine-specific, stored in <dataDir>/config.json.
 * Includes server ports, window prefs, embedding model config.
 */
const APP_DEFAULTS = {
  v: 3,
  vaultPath: '',
  startMinimized: false,
  verboseConsole: false,
  name: APP_NAME,
  api: { port: 43000, host: '127.0.0.1' },
  tts: { port: 42033, host: '127.0.0.1' },
  skipLinkScan: ['tags', 'state', 'status', 'narrate'],
  frontmatterHead: ['name', 'project', 'tags'],
  frontmatterTail: ['created', 'modified', 'summary'],
  embeddings: { model: 'Xenova/multilingual-e5-large', dimensions: 1024 },
}

/**
 * Vault-level defaults — stored in <vault>/.brain-thing/settings.json.
 * Synced across machines via Syncthing or similar.
 */
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
    { name: 'narrate',  type: 'string', desc: 'TTS collection name' },
  ],
}

// --- Signals ---

const ready = new Signal({ late: true, memorable: true })
const changed = new Signal()

// --- Mutable state ---

const state = {
  ...APP_DEFAULTS,
  ...VAULT_DEFAULTS,
  dataDir: null,
  vault: null,
  vectorCacheDir: null,
  modelCacheDir: null,
  resourcesPath: null,
  brainDir: null,
  _fields: {
    project: FIELD.STRING.describe('Project grouping'),
    tags: FIELD.LIST.describe('Hierarchical categorization'),
    created: FIELD.DATE.describe('Auto-set on creation'),
    modified: FIELD.DATE.describe('Auto-updated on every write'),
    summary: FIELD.STRING.describe('Brief description for semantic indexing'),
  },
}

Object.defineProperty(state, 'fields', {
  get () { return state._fields },
  set (v) { state._fields = v },
})

// --- Internal helpers ---

let configPath = null
let settingsPath = null
let settingsWatcher = null
let lastSettingsHash = null
let settingsDebounce = null

function loadJSON (filePath) {
  if (!filePath) return {}
  try { return JSON.parse(readFileSync(filePath, 'utf-8')) } catch { return {} }
}

/** Strip vault keys from app config to prevent cross-vault leaks */
function stripVaultKeys (obj) {
  for (const key of VAULT_KEYS) delete obj[key]
  return obj
}

function saveJSON (filePath, data) {
  if (!filePath) return
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function hashStr (str) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

function ensureBrainDir (vaultPath) {
  if (!vaultPath) return
  const dir = join(vaultPath, BRAIN_DIR)
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
    fields[def.name] = def.desc ? base.describe(def.desc) : base
  }
  return fields
}

function loadSettings () {
  return loadJSON(settingsPath)
}

function saveSettings (data) {
  saveJSON(settingsPath, data)
  try {
    lastSettingsHash = hashStr(readFileSync(settingsPath, 'utf-8'))
  } catch { /* ignore */ }
}

// --- Migration ---

function migrateAppConfig (stored) {
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
    saveJSON(configPath, stored)
  }
  if (stored.v < 3) {
    if (stored.organize?.projects) {
      for (const [key, val] of Object.entries(stored.organize.projects)) {
        if (typeof val === 'string') {
          stored.organize.projects[key] = { folder: val, rules: [] }
        }
      }
    }
    stored.v = 3
    saveJSON(configPath, stored)
  }
}

/** Create settings.json — migrate from config.json once, then defaults for new vaults */
function ensureSettingsFile (appStored) {
  if (!settingsPath || existsSync(settingsPath)) return
  const data = { ...VAULT_DEFAULTS }
  if (!appStored._settingsMigrated) {
    for (const key of VAULT_KEYS) {
      if (key in appStored) data[key] = appStored[key]
    }
    saveJSON(configPath, { ...appStored, _settingsMigrated: true })
  }
  saveSettings(data)
}

// --- Settings watcher (external changes via Syncthing etc.) ---

function stopSettingsWatcher () {
  if (settingsWatcher) { settingsWatcher.close(); settingsWatcher = null }
  if (settingsDebounce) { clearTimeout(settingsDebounce); settingsDebounce = null }
}

function startSettingsWatcher () {
  stopSettingsWatcher()
  if (!state.vault) return

  const watchDir = join(state.vault, BRAIN_DIR)
  if (!existsSync(watchDir)) return

  try {
    settingsWatcher = watch(watchDir, (_, filename) => {
      if (filename !== 'settings.json') return
      if (settingsDebounce) clearTimeout(settingsDebounce)
      settingsDebounce = setTimeout(() => {
        try {
          const raw = readFileSync(settingsPath, 'utf-8')
          const hash = hashStr(raw)
          if (hash === lastSettingsHash) return
          lastSettingsHash = hash
          applyConfig()
          changed.emit(state)
        } catch { /* file gone or unreadable */ }
      }, 500)
    })
  } catch { /* dir unavailable */ }
}

// --- Apply ---

function applyConfig () {
  const appStored = loadJSON(configPath)
  migrateAppConfig(appStored)

  const vaultPath = appStored.vaultPath || APP_DEFAULTS.vaultPath

  if (vaultPath) {
    ensureBrainDir(vaultPath)
    settingsPath = join(vaultPath, BRAIN_DIR, 'settings.json')
    ensureSettingsFile(appStored)
  } else {
    settingsPath = null
  }

  const vaultStored = loadSettings()

  const app = { ...APP_DEFAULTS, ...appStored }
  const vault = { ...VAULT_DEFAULTS, ...vaultStored }

  if (Array.isArray(vault.fields)) {
    for (const f of vault.fields) f.core = CORE_FIELD_NAMES.has(f.name) || false
  }

  // App config
  state.vaultPath = app.vaultPath
  state.vault = app.vaultPath || null
  state.name = app.name
  state.api = app.api
  state.tts = app.tts
  state.skipLinkScan = app.skipLinkScan
  state.frontmatterHead = app.frontmatterHead
  state.frontmatterTail = app.frontmatterTail
  state.embeddings = app.embeddings

  // Vault settings
  state.guideline = vault.guidelineName
  state.features = vault.features
  state.ignore = vault.ignore
  state.organize = vault.organize
  state._fields = buildFields(vault.fields)

  // Paths
  if (state.dataDir) {
    state.modelCacheDir = join(state.dataDir, 'models')
  }
  if (state.vault) {
    state.vectorCacheDir = join(state.vault, BRAIN_DIR, 'vector-cache')
  }
}

// --- Public API ---

function init (dataDir) {
  state.dataDir = dataDir
  configPath = join(dataDir, 'config.json')
  applyConfig()
  startSettingsWatcher()
  ready.emit(state)
}

function get () {
  const appStored = stripVaultKeys(loadJSON(configPath))
  const vaultStored = loadSettings()
  const merged = { ...APP_DEFAULTS, ...VAULT_DEFAULTS, ...appStored, ...vaultStored }
  if (Array.isArray(merged.fields)) {
    for (const f of merged.fields) f.core = CORE_FIELD_NAMES.has(f.name) || false
  }
  return merged
}

function set (patch) {
  const appPatch = {}
  const vaultPatch = {}
  for (const [key, value] of Object.entries(patch)) {
    if (VAULT_KEYS.has(key)) vaultPatch[key] = value
    else appPatch[key] = value
  }

  if (Object.keys(appPatch).length) {
    const current = stripVaultKeys(loadJSON(configPath))
    saveJSON(configPath, { ...APP_DEFAULTS, ...current, ...appPatch })
  }

  if (Object.keys(vaultPatch).length && settingsPath) {
    const current = loadSettings()
    saveSettings({ ...VAULT_DEFAULTS, ...current, ...vaultPatch })
  }

  const prevVault = state.vault
  applyConfig()
  if (state.vault !== prevVault) startSettingsWatcher()
  changed.emit(state)
}

function reset () {
  if (configPath && existsSync(configPath)) unlinkSync(configPath)
  if (settingsPath && existsSync(settingsPath)) unlinkSync(settingsPath)
  stopSettingsWatcher()
  applyConfig()
  changed.emit(state)
}

function getPath () {
  return configPath
}

export const cfg = { ready, changed, state, init, get, set, reset, getPath }
