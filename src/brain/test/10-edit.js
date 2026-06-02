import { TOOLS } from '../../shared/specs.js'

export default async function ({ post, assert }) {
  // === Attributes-only edit ===
  await post(TOOLS.GET, { name: 'Alpha' })
  {
    const { data } = await post(TOOLS.EDIT, { name: 'Alpha', attributes: { summary: 'Updated summary' } })
    assert(data.text.includes('Edited'), 'attributes-only edit confirmed')

    const { data: check } = await post(TOOLS.GET, { name: 'Alpha' })
    assert(check.text.includes('Updated summary'), 'summary changed')
    assert(check.text.includes('project: TestProject'), 'project preserved')
  }

  // === Read-before-write precondition ===
  {
    const { data } = await post(TOOLS.EDIT, { name: 'Beta', attributes: { summary: 'sneaky' } })
    assert(data.text.includes('must be read'), 'rejected without prior get')
  }

  // === Single replace op ===
  await post(TOOLS.GET, { name: 'Beta' })
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'Beta',
      operations: [{ op: 'replace', old: 'keyword findme', new: 'keyword replaced' }],
    })
    assert(data.text.includes('Edited'), 'single replace confirmed')

    const { data: check } = await post(TOOLS.GET, { name: 'Beta' })
    assert(check.text.includes('keyword replaced'), 'single replace applied')
  }

  // === Multiple ops in order — N sees N-1 output ===
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'Beta',
      operations: [
        { op: 'replace', old: 'keyword replaced', new: 'keyword final' },
        { op: 'replace', old: 'Beta has', new: 'Beta contains' },
      ],
    })
    assert(data.text.includes('Edited'), 'multi-op edit confirmed')

    const { data: check } = await post(TOOLS.GET, { name: 'Beta' })
    assert(check.text.includes('keyword final'), 'first op applied')
    assert(check.text.includes('Beta contains'), 'second op applied')
  }

  // === Insert: position end (default) ===
  await post(TOOLS.GET, { name: 'Alpha' })
  await post(TOOLS.EDIT, { name: 'Alpha', operations: [{ op: 'insert', text: '\nEnd line' }] })

  // === Insert: position start ===
  await post(TOOLS.GET, { name: 'Alpha' })
  await post(TOOLS.EDIT, { name: 'Alpha', operations: [{ op: 'insert', text: 'Start line\n', position: 'start' }] })

  // Verify positional ordering + no whitespace added
  {
    const { data: check } = await post(TOOLS.GET, { name: 'Alpha' })
    const startIdx = check.text.indexOf('Start line')
    const endIdx = check.text.indexOf('End line')
    assert(startIdx >= 0 && endIdx > startIdx, 'start before end')
    assert(/Start line\n/.test(check.text), 'no whitespace added before user newline')
    assert(/\nEnd line/.test(check.text), 'no whitespace added after user newline')
  }

  // === Insert: marker after / before ===
  await post(TOOLS.GET, { name: 'Alpha' })
  await post(TOOLS.EDIT, {
    name: 'Alpha',
    operations: [{ op: 'insert', text: ' [AFTER]', marker: 'Start line', position: 'after' }],
  })

  await post(TOOLS.GET, { name: 'Alpha' })
  await post(TOOLS.EDIT, {
    name: 'Alpha',
    operations: [{ op: 'insert', text: '[BEFORE] ', marker: 'End line', position: 'before' }],
  })
  {
    const { data: check } = await post(TOOLS.GET, { name: 'Alpha' })
    assert(check.text.includes('[BEFORE] End line'), 'before marker insert')
    assert(check.text.includes('Start line [AFTER]'), 'after marker insert')
  }

  // === Remove op ===
  await post(TOOLS.GET, { name: 'Alpha' })
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'Alpha',
      operations: [{ op: 'remove', text: '[BEFORE] ' }],
    })
    assert(data.text.includes('Edited'), 'remove confirmed')

    const { data: check } = await post(TOOLS.GET, { name: 'Alpha' })
    assert(!check.text.includes('[BEFORE] '), 'remove applied')
  }

  // === Sacrificial entry for the rest (don't pollute Alpha/Beta further) ===
  await post(TOOLS.CREATE, { name: 'EditTest', content: 'original body', attributes: { tags: ['test'] } })

  // === Rewrite op alone ===
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'EditTest',
      operations: [{ op: 'rewrite', content: 'completely new body' }],
    })
    assert(data.text.includes('Edited'), 'rewrite confirmed')

    const { data: check } = await post(TOOLS.GET, { name: 'EditTest' })
    assert(check.text.includes('completely new body'), 'rewrite applied')
    assert(!check.text.includes('original body'), 'old body gone')
  }

  // === Rewrite + other ops → atomic failure ===
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'EditTest',
      operations: [
        { op: 'rewrite', content: 'should not happen' },
        { op: 'replace', old: 'completely', new: 'partially' },
      ],
    })
    assert(data.text.includes('Edit failed'), 'rewrite + other ops rejected')
    assert(data.text.includes('rewrite'), 'error names rewrite')

    const { data: check } = await post(TOOLS.GET, { name: 'EditTest' })
    assert(check.text.includes('completely new body'), 'EditTest unchanged after atomic failure')
    assert(!check.text.includes('should not happen'), 'rewrite content not persisted')
  }

  // === Attributes + operations together ===
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'EditTest',
      operations: [{ op: 'insert', text: '\nappended', position: 'end' }],
      attributes: { summary: 'New summary' },
    })
    assert(data.text.includes('Edited'), 'combined edit confirmed')

    const { data: check } = await post(TOOLS.GET, { name: 'EditTest' })
    assert(check.text.includes('appended'), 'insert applied')
    assert(check.text.includes('New summary'), 'attribute applied')
  }

  // === Atomic failure: one bad op aborts everything ===
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'EditTest',
      operations: [
        { op: 'replace', old: 'appended', new: 'SHOULD_NOT_APPEAR' },
        { op: 'insert', text: 'no go', marker: 'nonexistent-marker', position: 'after' },
      ],
    })
    assert(data.text.includes('Edit failed'), 'atomic failure on missing marker')

    const { data: check } = await post(TOOLS.GET, { name: 'EditTest' })
    assert(!check.text.includes('SHOULD_NOT_APPEAR'), 'replace did not persist')
    assert(check.text.includes('appended'), 'original text intact after atomic rollback')
  }

  // === Multi-error reply ===
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'EditTest',
      operations: [
        { op: 'replace', old: 'NOPE_NOT_THERE', new: 'x' },
        { op: 'insert', text: 'y', marker: 'ALSO_NOT_THERE', position: 'after' },
      ],
    })
    assert(data.text.includes('Edit failed'), 'multi-error reply')
    assert(data.text.includes('op[0]'), 'first op named in error')
    assert(data.text.includes('op[1]'), 'second op named in error')
  }

  // === Banned attribute keys rejected ===
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data } = await post(TOOLS.EDIT, { name: 'EditTest', attributes: { name: 'NewName' } })
    assert(data.text.includes('Edit failed'), 'banned name rejected')
    assert(data.text.includes('"name"'), 'error names the banned field')
  }

  // === Array-only field rejected when scalar ===
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data } = await post(TOOLS.EDIT, { name: 'EditTest', attributes: { tags: 'not-an-array' } })
    assert(data.text.includes('Edit failed'), 'scalar tags rejected')
    assert(data.text.includes('"tags"'), 'error names the array field')
  }

  // === null removes scalar attribute ===
  await post(TOOLS.EDIT, { name: 'EditTest', attributes: { status: 'wip' } })
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data: before } = await post(TOOLS.GET, { name: 'EditTest' })
    assert(before.text.includes('status: wip'), 'status attribute set before removal')

    await post(TOOLS.EDIT, { name: 'EditTest', attributes: { status: null } })
    const { data: after } = await post(TOOLS.GET, { name: 'EditTest' })
    assert(!after.text.includes('status:'), 'status removed after null')
  }

  // === null removes array attribute (non-tags) ===
  await post(TOOLS.GET, { name: 'EditTest' })
  await post(TOOLS.EDIT, { name: 'EditTest', attributes: { aliases: ['Foo', 'Bar'] } })
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data: before } = await post(TOOLS.GET, { name: 'EditTest' })
    assert(before.text.includes('aliases:'), 'aliases set before removal')

    await post(TOOLS.EDIT, { name: 'EditTest', attributes: { aliases: null } })
    const { data: after } = await post(TOOLS.GET, { name: 'EditTest' })
    assert(!after.text.includes('aliases:'), 'aliases removed after null')
  }

  // === tags = null rejected (tags must always have ≥1) ===
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data } = await post(TOOLS.EDIT, { name: 'EditTest', attributes: { tags: null } })
    assert(data.text.includes('Edit failed'), 'tags=null rejected')
    assert(data.text.includes('"tags"'), 'error names tags')
  }

  // === tags = [] rejected ===
  await post(TOOLS.GET, { name: 'EditTest' })
  {
    const { data } = await post(TOOLS.EDIT, { name: 'EditTest', attributes: { tags: [] } })
    assert(data.text.includes('Edit failed'), 'tags=[] rejected')
    assert(data.text.includes('non-empty'), 'error mentions non-empty')
  }

  // === all: true semantics ===
  await post(TOOLS.CREATE, { name: 'ReplaceAllTest', content: 'foo foo foo', attributes: { tags: ['test'] } })
  await post(TOOLS.GET, { name: 'ReplaceAllTest' })
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'ReplaceAllTest',
      operations: [{ op: 'replace', old: 'foo', new: 'bar', all: true }],
    })
    assert(data.text.includes('Edited'), 'replace all confirmed')

    const { data: check } = await post(TOOLS.GET, { name: 'ReplaceAllTest' })
    assert(/bar bar bar/.test(check.text), 'all matches replaced')
  }

  // === Ambiguous replace without all → error ===
  await post(TOOLS.CREATE, { name: 'AmbigTest', content: 'baz baz baz', attributes: { tags: ['test'] } })
  await post(TOOLS.GET, { name: 'AmbigTest' })
  {
    const { data } = await post(TOOLS.EDIT, {
      name: 'AmbigTest',
      operations: [{ op: 'replace', old: 'baz', new: 'qux' }],
    })
    assert(data.text.includes('Edit failed'), 'ambiguous replace rejected')
    assert(/matched \d+ times/.test(data.text), 'error names match count')

    const { data: check } = await post(TOOLS.GET, { name: 'AmbigTest' })
    assert(check.text.includes('baz baz baz'), 'content unchanged on ambiguous reject')
  }

  // === Cleanup sacrificial entries ===
  await post(TOOLS.DELETE, { name: 'EditTest' })
  await post(TOOLS.DELETE, { name: 'ReplaceAllTest' })
  await post(TOOLS.DELETE, { name: 'AmbigTest' })
}
