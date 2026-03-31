export default async function ({ post, assert }) {
  const { data } = await post('tags_list', {})
  assert(data.text.includes('test'), 'test tag')

  const { data: drill } = await post('tags_list', { tag: 'test' })
  assert(drill.text.includes('test/sub'), 'subtag visible')
  assert(drill.text.includes('tagged exactly'), 'exact match label')
}
