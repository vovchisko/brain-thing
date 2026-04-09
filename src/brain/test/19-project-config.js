export default async function ({ post, get, assert }) {
  // List — should show TestProject from seed
  const list = await post('project_config', {})
  assert(list.data.text.includes('TestProject'), 'lists TestProject')

  // Create new project
  const create = await post('project_config', {
    project: 'NP',
    folder: 'New Project',
    rules: [{ tag: 'np/doc', folder: 'Docs' }],
  })
  assert(create.data.text.includes('Created'), 'created NP')
  assert(create.data.text.includes('[[NP]]'), 'home entry created')

  // Verify home entry exists
  const home = await post('get', { name: 'NP' })
  assert(home.data.text.includes('project: NP'), 'home entry has project')
  assert(home.data.text.includes('New Project project'), 'home entry has summary')

  // Update project — add rule
  const update = await post('project_config', {
    project: 'NP',
    folder: 'New Project Updated',
    rules: [
      { tag: 'np/doc', folder: 'Docs' },
      { tag: 'np/task', folder: 'Tasks' },
    ],
  })
  assert(update.data.text.includes('Updated'), 'updated NP')

  // List again — both projects
  const list2 = await post('project_config', {})
  assert(list2.data.text.includes('TestProject'), 'still has TestProject')
  assert(list2.data.text.includes('NP'), 'has NP')

  // Show single project
  const show = await post('project_config', { project: 'NP' })
  assert(show.data.text.includes('New Project Updated'), 'shows updated folder')
  assert(show.data.text.includes('np/doc'), 'shows tag rule')

  // Remove project
  const remove = await post('project_config', { project: 'NP', remove: true })
  assert(remove.data.text.includes('removed'), 'removed NP')
  assert(remove.data.text.includes('untouched'), 'entries untouched note')

  // Verify entry still exists after project removal
  const stillThere = await post('get', { name: 'NP' })
  assert(stillThere.data.text.includes('NP'), 'entry still exists after project removal')

  // Remove nonexistent
  const noSuch = await post('project_config', { project: 'NOPE', remove: true })
  assert(noSuch.data.text.includes('not found'), 'remove nonexistent')

  // Create project where entry already exists (NP still in store from earlier)
  const create2 = await post('project_config', { project: 'NP', folder: 'NP Reborn' })
  assert(create2.data.text.includes('Created'), 'recreated NP')
  assert(!create2.data.text.includes('[[NP]] created'), 'skips home entry (already exists)')

  // Verify organize settings survive project changes
  const status = await get('status')
  assert(status.data.vault, 'vault still configured after project changes')

  // Create another project and verify TestProject + fallback rules survive
  await post('project_config', { project: 'ZZ', folder: 'Zzz' })
  // TestProject must still exist with its rules
  const list3 = await post('project_config', { project: 'TestProject' })
  assert(list3.data.text.includes('TestProject'), 'TestProject survives other project changes')
  assert(list3.data.text.includes('test/docs'), 'TestProject rules survive')

  // Validation: bad folder
  const badFolder = await post('project_config', { project: 'VV', folder: 'My:Project' })
  assert(badFolder.data.text.includes('invalid characters'), 'rejects bad folder chars')

  const badRuleFolder = await post('project_config', {
    project: 'VV', folder: 'Good', rules: [{ tag: 'x', folder: 'Sub?Dir' }],
  })
  assert(badRuleFolder.data.text.includes('invalid characters'), 'rejects bad rule folder')

  const dotFolder = await post('project_config', { project: 'VV', folder: '.hidden' })
  assert(dotFolder.data.text.includes('dot'), 'rejects dot folder')

  // Validation: bad project key
  const badKey = await post('project_config', { project: 'A/B', folder: 'Test' })
  assert(badKey.data.text.includes('invalid'), 'rejects bad project key')

  // Cleanup
  await post('project_config', { project: 'NP', remove: true })
  await post('project_config', { project: 'ZZ', remove: true })
}
