import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  const { data } = await post(TOOLS.ATTRIBUTES, { project: 'TestProject' })
  assert(data.text.includes('project'), 'project attribute listed')
  assert(data.text.includes('[project: TestProject]'), 'project filter shown')
}
