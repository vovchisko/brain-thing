import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  const { data } = await post(TOOLS.DELETE, { name: 'Gamma Renamed' })
  assert(data.text.includes('Deleted'), 'delete confirmed')

  const { data: check } = await post(TOOLS.GET, { name: 'Gamma Renamed' })
  assert(check.text.includes('not found'), 'entry gone')
}
