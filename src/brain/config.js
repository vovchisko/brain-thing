import { join }                                                                  from 'path'
import { existsSync, mkdirSync, readFileSync, unlinkSync, watch, writeFileSync } from 'fs'
import crypto                                                                    from 'node:crypto'
import Signal                                                                    from 'a-signal'
import { ATTRIBUTE }                                                             from './lib/attribute-types.js'
import { APP_NAME }                                                              from '../shared/constants.js'
import { TOOLS }                                                                 from '../shared/specs.js'
import { ATTRIBUTE_TYPE }                                                        from '../shared/attribute-types.js'
import { createBus }                                                             from './lib/bus.js'
import { deepClone, deepFreeze }                                                 from './lib/utils.js'

export { TOOLS }

const bus = createBus('config', { system: true })

const BRAIN_DIR = '.brain-thing'

const CORE_ATTRIBUTE_NAMES = new Set(['project', 'tags', 'created', 'modified', 'summary'])
const TYPE_MAP = {
  [ATTRIBUTE_TYPE.STRING]: ATTRIBUTE.STRING,
  [ATTRIBUTE_TYPE.DATE]:   ATTRIBUTE.DATE,
  [ATTRIBUTE_TYPE.NUMBER]: ATTRIBUTE.NUMBER,
  [ATTRIBUTE_TYPE.LIST]:   ATTRIBUTE.LIST,
}

/** Keys that lived in app config before v4 migration but belong to vault settings */
const VAULT_MIGRATION_KEYS = ['attributes', 'ignore', 'organize', 'features', 'guidelineName']

/** Allowlists for public set() API */
const SYSTEM_KEYS = new Set(['v', 'vaultPath', 'startMinimized', 'verboseConsole', 'windowBounds', 'name', 'apiPort'])
const VAULT_KEYS  = new Set(['guidelineName', 'features', 'attributes', 'ignore', 'organize', 'narrate', 'tools'])

/** Hardcoded values — no UI, no external override */
export const CONSTANTS = deepFreeze({
  api: { port: 43000, host: '127.0.0.1' },
  tts: { port: 42033, host: '127.0.0.1' },
  embeddings: { model: 'Xenova/multilingual-e5-large', dimensions: 1024 },
  skipLinkScan: ['tags', 'state', 'status'],
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
  apiPort: CONSTANTS.api.port,
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
          { attribute: 'status', value: 'done', folder: 'Archive' },
        ],
      },
    },
    rules: [
      { tag: 'my/log', folder: 'Logs' },
    ],
  },
  narrate: {
    rules: [],
  },
  // Per-tool MCP enable/disable. migrateVaultConfig materializes this — every tool present, default true.
  tools: {},
  attributes: [
    { name: 'project',  type: ATTRIBUTE_TYPE.STRING, desc: 'Project grouping',                       core: true },
    { name: 'tags',     type: ATTRIBUTE_TYPE.LIST,   desc: 'Hierarchical categorization',            core: true },
    { name: 'created',  type: ATTRIBUTE_TYPE.DATE,   desc: 'Auto-set on creation',                   core: true },
    { name: 'modified', type: ATTRIBUTE_TYPE.DATE,   desc: 'Auto-updated on every write',            core: true },
    { name: 'summary',  type: ATTRIBUTE_TYPE.STRING, desc: 'Brief description for semantic indexing', core: true },
    { name: 'aliases',  type: ATTRIBUTE_TYPE.LIST,   desc: 'Alternative names' },
    { name: 'status',   type: ATTRIBUTE_TYPE.STRING, desc: 'Free-form status' },
    { name: 'priority', type: ATTRIBUTE_TYPE.NUMBER, desc: 'Priority level' },
    { name: 'due',      type: ATTRIBUTE_TYPE.DATE,   desc: 'Deadline' },
    { name: 'state',    type: ATTRIBUTE_TYPE.STRING, desc: 'Document maturity' },
  ],
}

// --- Runtime states ---

const systemState = {
  vaultPath: '',
  startMinimized: false,
  verboseConsole: false,
  name: APP_NAME,
  windowBounds: null,
  apiPort: CONSTANTS.api.port,
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
  narrate: deepClone(VAULT_DEFAULTS.narrate),
  tools: deepClone(VAULT_DEFAULTS.tools),
  attributes: buildAttributes(VAULT_DEFAULTS.attributes),
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

function buildAttributes (arr = []) {
  const attributes = {
    project: ATTRIBUTE.STRING.describe('Project grouping'),
    tags: ATTRIBUTE.LIST.describe('Hierarchical categorization'),
    created: ATTRIBUTE.DATE.describe('Auto-set on creation'),
    modified: ATTRIBUTE.DATE.describe('Auto-updated on every write'),
    summary: ATTRIBUTE.STRING.describe('Brief description for semantic indexing'),
  }
  for (const def of arr) {
    const base = TYPE_MAP[def.type] || ATTRIBUTE.STRING
    attributes[def.name] = base.describe(def.desc || '')
  }
  return attributes
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
          // legacy vault keys may still use `fields` — map to `attributes`
          if ('fields' in stored && !('attributes' in stored)) stored.attributes = stored.fields
          for (const key of VAULT_MIGRATION_KEYS) {
            if (key in stored) vaultData[key] = stored[key]
          }
          saveJSON(legacyVaultFile, vaultData)
        } catch (err) {
          bus.warn('migrate', `vault key relocation failed: ${ err.message }`)
        }
      }
    }
    for (const key of [...VAULT_MIGRATION_KEYS, 'fields']) {
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
  systemState.apiPort = Number.isFinite(merged.apiPort) ? merged.apiPort : CONSTANTS.api.port

  if (systemState.dataDir) {
    systemState.modelCacheDir = join(systemState.dataDir, 'models')
  }
}

function migrateVaultConfig (stored) {
  let changed = false
  // Legacy: rename `fields` → `attributes`
  if (Array.isArray(stored.fields) && !Array.isArray(stored.attributes)) {
    stored.attributes = stored.fields
    delete stored.fields
    changed = true
  }
  // Drop legacy `narrate` attribute def from user config (attribute replaced by narrate.rules)
  if (Array.isArray(stored.attributes)) {
    const before = stored.attributes.length
    stored.attributes = stored.attributes.filter(a => a.name !== 'narrate')
    if (stored.attributes.length !== before) changed = true
  }
  // Legacy: rename rule `field` → `attribute` in organize rules
  function renameRuleField (rule) {
    if (rule && 'field' in rule && !('attribute' in rule)) {
      rule.attribute = rule.field
      delete rule.field
      return true
    }
    return false
  }
  if (stored.organize) {
    for (const rule of stored.organize.rules || []) {
      if (renameRuleField(rule)) changed = true
    }
    for (const proj of Object.values(stored.organize.projects || {})) {
      for (const rule of proj.rules || []) {
        if (renameRuleField(rule)) changed = true
      }
    }
  }
  // Normalize tool toggles: materialize an entry for every current tool (default enabled),
  // drop keys for tools that no longer exist (renamed/removed).
  const prevTools = stored.tools && typeof stored.tools === 'object' ? stored.tools : {}
  const tools = {}
  for (const name of Object.values(TOOLS)) tools[name] = prevTools[name] !== false
  if (JSON.stringify(tools) !== JSON.stringify(stored.tools)) {
    stored.tools = tools
    changed = true
  }
  if (changed && vaultFilePath) saveJSON(vaultFilePath, stored)
  return stored
}

function applyVaultConfig () {
  if (!systemState.vaultPath) {
    vaultFilePath = null
    vaultState.guidelineName = VAULT_DEFAULTS.guidelineName
    vaultState.features = deepClone(VAULT_DEFAULTS.features)
    vaultState.ignore = deepClone(VAULT_DEFAULTS.ignore)
    vaultState.organize = deepClone(VAULT_DEFAULTS.organize)
    vaultState.narrate = deepClone(VAULT_DEFAULTS.narrate)
    vaultState.tools = deepClone(VAULT_DEFAULTS.tools)
    vaultState.attributes = buildAttributes(VAULT_DEFAULTS.attributes)
    vaultState.vectorCacheDir = null
    lastSettingsHash = null
    return
  }
  ensureBrainDir(systemState.vaultPath)
  vaultFilePath = join(systemState.vaultPath, BRAIN_DIR, 'settings.json')

  ensureSettingsFile()

  const stored = migrateVaultConfig(loadVaultFile())
  const merged = { ...VAULT_DEFAULTS, ...stored }

  if (Array.isArray(merged.attributes)) {
    for (const a of merged.attributes) a.core = CORE_ATTRIBUTE_NAMES.has(a.name) || false
  }

  vaultState.guidelineName = merged.guidelineName
  vaultState.features = deepClone(merged.features)
  vaultState.ignore = deepClone(merged.ignore)
  vaultState.organize = deepClone(merged.organize)
  vaultState.narrate = deepClone(merged.narrate)
  vaultState.tools = deepClone(merged.tools)
  vaultState.attributes = buildAttributes(merged.attributes)
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
  if (Array.isArray(merged.attributes)) {
    for (const a of merged.attributes) a.core = CORE_ATTRIBUTE_NAMES.has(a.name) || false
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
