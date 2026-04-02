export default async function ({ post, assert }) {
  // Read first
  await post('get', { name: 'Beta' })

  // Single mode
  const { data } = await post('replace', { name: 'Beta', old_string: 'keyword findme', new_string: 'keyword replaced' })
  assert(data.text.includes('Replaced'), 'single replace confirmed')

  const { data: check } = await post('get', { name: 'Beta' })
  assert(check.text.includes('keyword replaced'), 'single replace applied')

  // Batch mode (pairs) — get already refreshed seen hash above
  const { data: batch } = await post('replace', {
    name: 'Beta',
    pairs: [
      { old_string: 'keyword replaced', new_string: 'keyword final' },
      { old_string: 'Beta has', new_string: 'Beta contains' },
    ],
  })
  assert(batch.text.includes('Replaced'), 'batch replace confirmed')

  const { data: check2 } = await post('get', { name: 'Beta' })
  assert(check2.text.includes('keyword final'), 'batch pair 1 applied')
  assert(check2.text.includes('Beta contains'), 'batch pair 2 applied')
}
