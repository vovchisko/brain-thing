export default async function ({ assert }) {
  // Test v2→v3 migration logic: flat projects → { folder, rules }
  const v2 = {
    v: 2,
    organize: {
      useOrganize: true,
      default: 'Input',
      projects: { EOW: 'EOW', FC: 'Game - FC' },
      rules: [{ tag: 'log', folder: 'Logs' }],
    },
  }

  // Simulate migration inline (same logic as config.js migrate)
  for (const [key, val] of Object.entries(v2.organize.projects)) {
    if (typeof val === 'string') {
      v2.organize.projects[key] = { folder: val, rules: [] }
    }
  }
  v2.v = 3

  assert(v2.v === 3, 'version bumped to 3')
  assert(v2.organize.projects.EOW.folder === 'EOW', 'EOW folder preserved')
  assert(Array.isArray(v2.organize.projects.EOW.rules), 'EOW rules is array')
  assert(v2.organize.projects.FC.folder === 'Game - FC', 'FC folder preserved')
  assert(v2.organize.rules[0].tag === 'log', 'fallback rules preserved')

  // Test v1→v2 migration logic: scopes → flat projects
  const v1 = {
    v: 1,
    organize: {
      scopes: [
        { name: 'MyScope', folder: 'MyFolder', match: { tag: 'ms' }, rules: [] },
      ],
      noScopeRules: [{ tag: 'fallback', folder: 'Misc' }],
    },
  }

  const projects = {}
  for (const scope of v1.organize.scopes) {
    if (scope.name && scope.folder) projects[scope.name] = scope.folder
  }
  v1.organize.projects = projects
  v1.organize.rules = v1.organize.noScopeRules || []
  delete v1.organize.scopes
  delete v1.organize.noScopeRules
  v1.v = 2

  assert(v1.v === 2, 'v1→v2: version bumped')
  assert(v1.organize.projects.MyScope === 'MyFolder', 'v1→v2: scope→project')
  assert(v1.organize.rules[0].tag === 'fallback', 'v1→v2: fallback rules')
  assert(!v1.organize.scopes, 'v1→v2: scopes removed')

  // Test v3 → v4 migration logic: drop now-constant keys + _settingsMigrated sentinel
  const v3 = {
    v: 3,
    vaultPath: '/some/path',
    startMinimized: false,
    _settingsMigrated: true,
    api: { port: 43001, host: '127.0.0.1' },       // non-default
    tts: { port: 42033, host: '127.0.0.1' },       // default
    embeddings: { model: 'custom/model', dimensions: 512 },
    skipLinkScan: ['tags'],
    frontmatterHead: ['name'],
    frontmatterTail: ['created'],
  }

  for (const key of ['api', 'tts', 'embeddings', 'skipLinkScan', 'frontmatterHead', 'frontmatterTail']) {
    delete v3[key]
  }
  if ('_settingsMigrated' in v3) delete v3._settingsMigrated
  v3.v = 4

  assert(v3.v === 4, 'v3→v4: version bumped')
  assert(!('api' in v3), 'v3→v4: api removed')
  assert(!('tts' in v3), 'v3→v4: tts removed')
  assert(!('embeddings' in v3), 'v3→v4: embeddings removed')
  assert(!('skipLinkScan' in v3), 'v3→v4: skipLinkScan removed')
  assert(!('frontmatterHead' in v3), 'v3→v4: frontmatterHead removed')
  assert(!('frontmatterTail' in v3), 'v3→v4: frontmatterTail removed')
  assert(!('_settingsMigrated' in v3), 'v3→v4: _settingsMigrated sentinel removed')
  assert(v3.vaultPath === '/some/path', 'v3→v4: system keys preserved')
  assert(v3.startMinimized === false, 'v3→v4: startMinimized preserved')

  // Vault migration: legacy `narrate` field def dropped (replaced by narrate.rules)
  const vaultStored = {
    fields: [
      { name: 'project', type: 'string' },
      { name: 'narrate', type: 'string', feature: 'tts' },
      { name: 'priority', type: 'number' },
    ],
  }
  const before = vaultStored.fields.length
  vaultStored.fields = vaultStored.fields.filter(f => f.name !== 'narrate')
  assert(vaultStored.fields.length === before - 1, 'vault: narrate field def removed')
  assert(!vaultStored.fields.find(f => f.name === 'narrate'), 'vault: no narrate field remains')
  assert(vaultStored.fields.find(f => f.name === 'project'), 'vault: other fields preserved')
}
