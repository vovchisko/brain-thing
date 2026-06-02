import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  const { data } = await post(TOOLS.TAGS_LIST, {})
  assert(data.text.includes('test'), 'test tag')

  const { data: drill } = await post(TOOLS.TAGS_LIST, { tag: 'test' })
  assert(drill.text.includes('test/sub'), 'subtag visible')
  assert(drill.text.includes('tagged exactly'), 'exact match label')
}
