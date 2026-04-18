export default async function ({ post, assert }) {
  const { data } = await post('get', { name: 'Alpha' })
  assert(data.text.includes('Alpha'), 'found Alpha')
  assert(data.text.includes('project: TestProject'), 'project in output')

  const { data: miss } = await post('get', { name: 'Nonexistent' })
  assert(miss.text.includes('not found'), 'not found message')

  // Backlinks as list with inline meta + word count
  await post('create', { name: 'Referencer', content: 'See [[Alpha]] for details.', tags: ['test'], project: 'TestProject' })
  const { data: bl } = await post('get', { name: 'Alpha' })
  assert(bl.text.includes('Backlinks (1):'), 'backlinks header has count')
  assert(/- \[\[Referencer\]\]/.test(bl.text), 'backlink line names entry')
  assert(/Referencer\]\].*— \d+ words/.test(bl.text), 'backlink line shows word count inline')
  assert(/Referencer\]\].*\btest\b/.test(bl.text), 'backlink line shows tag inline')
  await post('delete', { name: 'Referencer' })
}
