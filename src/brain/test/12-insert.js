export default async function ({ post, assert }) {
  // Read first
  await post('get', { name: 'Alpha' })

  // Position: end (default)
  const { data: end } = await post('insert', { name: 'Alpha', text: '\nEnd line' })
  assert(end.text.includes('Inserted'), 'end insert confirmed')

  // Position: start — need fresh read since insert changed content
  await post('get', { name: 'Alpha' })
  const { data: start } = await post('insert', { name: 'Alpha', text: 'Start line\n', position: 'start' })
  assert(start.text.includes('Inserted'), 'start insert confirmed')

  // Verify order
  const { data: check } = await post('get', { name: 'Alpha' })
  const content = check.text
  const startIdx = content.indexOf('Start line')
  const endIdx = content.indexOf('End line')
  assert(startIdx < endIdx, 'start before end')

  // Marker: after
  await post('insert', { name: 'Alpha', text: ' [AFTER]', marker: 'Start line', position: 'after' })

  // Marker: before — need fresh read
  await post('get', { name: 'Alpha' })
  await post('insert', { name: 'Alpha', text: '[BEFORE] ', marker: 'End line', position: 'before' })
  const { data: beforeCheck } = await post('get', { name: 'Alpha' })
  assert(beforeCheck.text.includes('[BEFORE] End line'), 'before marker insert')
}
