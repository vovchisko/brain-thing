import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  const { data } = await post(TOOLS.LOOK_AROUND, {})
  assert(data.text.includes('TestProject'), 'shows TestProject')
  assert(data.text.includes('Configured attributes'), 'lists configured attributes')
}
