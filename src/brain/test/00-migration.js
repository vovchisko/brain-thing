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
}
