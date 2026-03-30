import { join }                                                from 'path'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { FIELD }                                               from './lib/field-types.js'

export const TOOLS = Object.freeze({
  GET: 'get',
  WHAT_IS: 'what_is',
  GREP: 'grep',
  LOOK_AROUND: 'look_around',
  TAGS_LIST: 'tags_list',
  CREATE: 'create',
  UPDATE: 'update',
  REPLACE: 'replace',
  INSERT: 'insert',
  DELETE: 'delete',
  RENAME: 'rename',
  FIELDS: 'fields',
  SEARCH: 'search',
  NARRATE: 'narrate',
  DIAGNOSTIC: 'diagnostic',
})

const CORE_FIELD_NAMES = new Set(['tags', 'created', 'modified', 'summary'])

const TYPE_MAP = { string: FIELD.STRING, date: FIELD.DATE, number: FIELD.NUMBER, list: FIELD.LIST }

const DEFAULTS = {
  v: 1,
  vaultPath: '',
  guidelineName: 'HOME',
  normalizeTypography: false,
  verboseConsole: false,
  features: { tts: false },
  ignore: {
    folders: ['Sec', '_etc', 'Assets', 'Log', 'Templates'],
    patterns: ['excalidraw'],
  },
  organize: {
    useOrganize: false,
    default: 'Input',
    scopes: [],
    noScopeRules: [],
  },
  fields: [
    { name: 'tags',     type: 'list',   desc: 'Hierarchical categorization',           core: true },
    { name: 'created',  type: 'date',   desc: 'Auto-set on creation',                  core: true },
    { name: 'modified', type: 'date',   desc: 'Auto-updated on every write',           core: true },
    { name: 'summary',  type: 'string', desc: 'Brief description for semantic indexing', core: true },
    { name: 'aliases',  type: 'list',   desc: 'Alternative names' },
    { name: 'status',   type: 'string', desc: 'Free-form status' },
    { name: 'priority', type: 'number', desc: 'Priority level' },
    { name: 'due',      type: 'date',   desc: 'Deadline' },
    { name: 'state',    type: 'string', desc: 'Document maturity' },
    { name: 'narrate',  type: 'string', desc: 'TTS collection name' },
  ],

  // Brain internals (not editable via UI, but stored here for single source of truth)
  name: 'brain-thing',
  api: { port: 43000, host: '127.0.0.1' },
  tts: { port: 42033, host: '127.0.0.1' },
  skipLinkScan: ['tags', 'state', 'status', 'narrate'],
  frontmatterHead: ['name', 'tags'],
  frontmatterTail: ['created', 'modified', 'summary'],
  embeddings: { model: 'Xenova/multilingual-e5-large', dimensions: 1024, skipTags: [] },
}

// --- Runtime state (mutable, set by init) ---

export const config = {
  ...DEFAULTS,
  dataDir: null,
  vault: null,
  vectorCacheDir: null,
  modelCacheDir: null,
  resourcesPath: null,
  brainDir: null,

  // Resolved FieldType instances (built from fields array)
  _fields: {
    tags: FIELD.LIST.describe('Hierarchical categorization'),
    created: FIELD.DATE.describe('Auto-set on creation'),
    modified: FIELD.DATE.describe('Auto-updated on every write'),
    summary: FIELD.STRING.describe('Brief description for semantic indexing'),
  },
}

// Alias for code that reads config.fields as FieldType map
Object.defineProperty(config, 'fields', {
  get () { return config._fields },
  set (v) { config._fields = v },
})

let configPath = null

function load () {
  if (!configPath) return {}
  try { return JSON.parse(readFileSync(configPath, 'utf-8')) } catch { return {} }
}

function save (data) {
  if (!configPath) return
  writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8')
}

function buildFields (arr = []) {
  const fields = { ...config._fields }
  for (const def of arr) {
    const base = TYPE_MAP[def.type] || FIELD.STRING
    fields[def.name] = def.desc ? base.describe(def.desc) : base
  }
  return fields
}

function applyConfig () {
  const stored = load()
  const merged = { ...DEFAULTS, ...stored }

  // Enforce core flags
  if (Array.isArray(merged.fields)) {
    for (const f of merged.fields) {
      f.core = CORE_FIELD_NAMES.has(f.name) || false
    }
  }

  // Apply user-editable settings
  config.vaultPath = merged.vaultPath
  config.vault = merged.vaultPath || null
  config.guideline = merged.guidelineName
  config.normalizeTypography = merged.normalizeTypography
  config.features = merged.features
  config.ignore = merged.ignore
  config.organize = merged.organize
  config.name = merged.name
  config.api = merged.api
  config.tts = merged.tts
  config.skipLinkScan = merged.skipLinkScan
  config.frontmatterHead = merged.frontmatterHead
  config.frontmatterTail = merged.frontmatterTail
  config.embeddings = merged.embeddings
  config._fields = buildFields(merged.fields)

  // Computed paths
  if (config.dataDir) {
    config.vectorCacheDir = join(config.dataDir, 'vector-cache')
    config.modelCacheDir = join(config.dataDir, 'models')
  }
}

// --- Public API ---

export function init (dataDir) {
  config.dataDir = dataDir
  configPath = join(dataDir, 'config.json')
  applyConfig()
}

export function getConfig () {
  const stored = load()
  const merged = { ...DEFAULTS, ...stored }
  if (Array.isArray(merged.fields)) {
    for (const f of merged.fields) f.core = CORE_FIELD_NAMES.has(f.name) || false
  }
  return merged
}

export function setConfig (patch) {
  const current = load()
  save({ ...DEFAULTS, ...current, ...patch })
  applyConfig()
}

export function resetConfig () {
  if (configPath && existsSync(configPath)) unlinkSync(configPath)
  applyConfig()
}

export function getConfigPath () {
  return configPath
}
