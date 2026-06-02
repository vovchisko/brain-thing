import { __test } from '../modules/tts.js'
import { cfg }    from '../config.js'

export default async function ({ assert }) {
  const { ruleFor, ruleSignature, setConfig } = __test

  function setRules (rules) {
    setConfig({ vault: { narrate: { rules } }, const: { tts: { host: '127.0.0.1', port: 0 } }, system: { dataDir: null } })
  }

  // --- tag prefix match ---
  setRules([{ tag: 'story', voice: 'ava' }])
  assert(ruleFor({ tags: ['story-1'] }) !== null, 'tag prefix matches story-1')
  assert(ruleFor({ tags: ['storytime'] }) !== null, 'tag prefix matches storytime')
  assert(ruleFor({ tags: ['stori'] }) === null, 'partial prefix does not match')
  assert(ruleFor({ tags: ['log'] }) === null, 'tag mismatch returns null')
  assert(ruleFor({ tags: [] }) === null, 'no tags returns null')

  // --- attribute+value match ---
  setRules([{ attribute: 'project', value: 'BT', voice: 'ava' }])
  assert(ruleFor({ project: 'BT' }) !== null, 'attribute=value matches')
  assert(ruleFor({ project: 'OTHER' }) === null, 'attribute mismatch returns null')
  assert(ruleFor({}) === null, 'missing attribute returns null')

  // --- AND: tag and attribute both required ---
  setRules([{ tag: 'a', attribute: 'project', value: 'BT', voice: 'ava' }])
  assert(ruleFor({ tags: ['a-1'], project: 'BT' }) !== null, 'both match → match')
  assert(ruleFor({ tags: ['a-1'], project: 'X' }) === null, 'tag yes attribute no → no match')
  assert(ruleFor({ tags: ['z'], project: 'BT' }) === null, 'tag no attribute yes → no match')

  // --- empty rule (no tag, no attribute) is skipped ---
  setRules([{ voice: 'ava' }])
  assert(ruleFor({ tags: ['anything'], project: 'X' }) === null, 'empty rule never matches')

  // --- first match wins ---
  setRules([
    { tag: 'a', voice: 'first' },
    { tag: 'a', voice: 'second' },
  ])
  assert(ruleFor({ tags: ['a'] }).voice === 'first', 'first matching rule wins')

  // --- ruleSignature differs across params ---
  const baseRule = { voice: 'ava', language: 'en', collection: 'X' }
  const sig1 = ruleSignature(baseRule)
  const sig2 = ruleSignature({ ...baseRule, voice: 'alba' })
  const sig3 = ruleSignature({ ...baseRule, force: true })
  assert(sig1 !== sig2, 'signature changes with voice')
  assert(sig1 !== sig3, 'signature changes with force')
  assert(sig1 === ruleSignature(baseRule), 'signature stable for same input')

  // Restore real config so subsequent tests (or live tts.handleVaultChange) see actual state
  setConfig(cfg.state)
}
