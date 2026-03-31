import { join }                                                from 'path'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { FIELD }                                               from './lib/field-types.js'
import { APP_NAME, TOOLS }                                     from '../shared/constants.js'

export { TOOLS }

const CORE_FIELD_NAMES = new Set(['project', 'tags', 'created', 'modified', 'summary'])

const TYPE_MAP = { string: FIELD.STRING, date: FIELD.DATE, number: FIELD.NUMBER, list: FIELD.LIST }

/**
 * Default config. Written to config.json on first start.
 * User edits via Settings UI or manually in config.json.
 *
 * @property {number} v — Config schema version (for migrations)
 * @property {string} vaultPath — Absolute path to Obsidian vault
 * @property {string} guidelineName — Entry name whose content is appended to look_around output
 * @property {boolean} normalizeTypography — Replace curly quotes/dashes with ASCII on import
 * @property {boolean} verboseConsole — Show system events in UI log panel (frontend-only filter)
 * @property {Object} features — Feature gates (e.g. tts)
 * @property {Object} ignore — Vault scan exclusions
 * @property {string[]} ignore.folders — Folder names to skip entirely
 * @property {string[]} ignore.patterns — Filename substrings to skip (case-insensitive)
 * @property {Object} organize — File auto-organization settings
 * @property {boolean} organize.useOrganize — Master toggle
 * @property {string} organize.default — Folder for new entries (create tool lands here)
 * @property {Object<string, {folder: string, rules: Rule[]}>} organize.projects — Per-project folder mapping
 *   Each project: { folder: base folder, rules: [{ tag?, field?, value?, folder }] }
 *   Rules checked first (tag prefix match AND/OR field=value), fallback to base folder.
 * @property {Rule[]} organize.rules — Fallback rules for entries without a project
 * @property {Array<{name, type, desc, core?}>} fields — Frontmatter field definitions
 *   core fields (project, tags, created, modified, summary) can't be removed by user.
 *   User adds custom fields via Settings UI. Types: string, list, date, number.
 *
 * Brain internals (below fields line) are not in Settings UI but stored in config.json:
 * @property {string} name — App/MCP server name
 * @property {Object} api — Brain HTTP server { port, host }
 * @property {Object} tts — TTS server { port, host }
 * @property {string[]} skipLinkScan — Fields excluded from wikilink scanning
 * @property {string[]} frontmatterHead — Fields ordered first in YAML output
 * @property {string[]} frontmatterTail — Fields ordered last in YAML output
 * @property {Object} embeddings — Embedding model config { model, dimensions, skipTags }
 */
const DEFAULTS = {
  v: 3,
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
    // project key = value of entry.project field
    // folder = base folder in vault for this project's entries
    // rules = first-match rules for subfolders (tag prefix or field=value → folder)
    projects: {
      MP: {
        folder: 'My Project',
        rules: [
          { tag: 'mp/doc', folder: 'My Project/Docs' },
          { tag: 'mp/task', folder: 'My Project/Tasks' },
          { field: 'status', value: 'done', folder: 'My Project/Archive' },
        ],
      },
    },
    // Fallback rules for entries without a matching project
    rules: [
      { tag: 'my/log', folder: 'Logs' },
    ],
  },
  // Field definitions: core fields are protected, user adds custom ones.
  // type: string | list | date | number
  fields: [
    { name: 'project',  type: 'string', desc: 'Project grouping',                      core: true },
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

  // Brain internals — not editable via Settings UI, but stored in config.json
  name: APP_NAME,
  api: { port: 43000, host: '127.0.0.1' },   // Brain HTTP API
  tts: { port: 42033, host: '127.0.0.1' },   // External TTS server
  skipLinkScan: ['tags', 'state', 'status', 'narrate'],  // Fields excluded from wikilink detection
  frontmatterHead: ['name', 'project', 'tags'],           // Top of YAML output
  frontmatterTail: ['created', 'modified', 'summary'],    // Bottom of YAML output
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
    project: FIELD.STRING.describe('Project grouping'),
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

function migrate (stored) {
  if (!stored.v || stored.v < 2) {
    // v1 → v2: scopes → projects
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
    save(stored)
  }
  if (stored.v < 3) {
    // v2 → v3: flat projects map → { folder, rules }
    if (stored.organize?.projects) {
      for (const [key, val] of Object.entries(stored.organize.projects)) {
        if (typeof val === 'string') {
          stored.organize.projects[key] = { folder: val, rules: [] }
        }
      }
    }
    stored.v = 3
    save(stored)
  }
}

function applyConfig () {
  const stored = load()
  migrate(stored)
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
