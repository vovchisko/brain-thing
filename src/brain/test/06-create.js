import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  const { data } = await post(TOOLS.CREATE, { name: 'Delta', content: 'New entry', attributes: { tags: ['test'], project: 'TestProject' } })
  assert(data.text.includes('Delta'), 'created Delta')

  const { data: check } = await post(TOOLS.GET, { name: 'Delta' })
  assert(check.text.includes('project: TestProject'), 'project persisted')
}
