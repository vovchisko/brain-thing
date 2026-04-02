#!/usr/bin/env node

import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const BRAIN_DIR = dirname(fileURLToPath(import.meta.url))
const TEST_DIR = join(BRAIN_DIR, '_test-env')
const VAULT = join(TEST_DIR, 'vault')

let fastify = null

// --- Harness ---

function assert (cond, msg) {
  if (!cond) throw new Error(msg)
  console.log(`  ok: ${ msg }`)
}

function sleep (ms) { return new Promise(r => setTimeout(r, ms)) }

async function post (path, body = {}) {
  const res = await fastify.inject({ method: 'POST', url: `/${ path }`, payload: body })
  return { status: res.statusCode, data: JSON.parse(res.payload) }
}

async function get (path) {
  const res = await fastify.inject({ method: 'GET', url: `/${ path }` })
  return { status: res.statusCode, data: JSON.parse(res.payload) }
}

// --- Setup ---

function seedVault () {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(VAULT, { recursive: true })

  writeFileSync(join(TEST_DIR, 'config.json'), JSON.stringify({
    v: 2,
    vaultPath: VAULT,
    api: { port: 0, host: '127.0.0.1' },
    features: { tts: false },
    ignore: { folders: [], patterns: [] },
    organize: {
      useOrganize: true,
      default: 'Input',
      projects: {
        TestProject: {
          folder: 'TestProject',
          rules: [
            { tag: 'test/docs', folder: 'Docs' },
            { field: 'status', value: 'done', folder: 'Archive' },
          ],
        },
      },
      rules: [
        { tag: 'logs', folder: 'Logs' },
      ],
    },
    fields: [
      { name: 'project', type: 'string', desc: 'Project', core: true },
      { name: 'tags', type: 'list', desc: 'Tags', core: true },
      { name: 'created', type: 'date', desc: 'Created', core: true },
      { name: 'modified', type: 'date', desc: 'Modified', core: true },
      { name: 'summary', type: 'string', desc: 'Summary', core: true },
    ],
  }))

  const entries = [
    { name: 'Alpha', project: 'TestProject', tags: ['test', 'test/sub'], summary: 'First entry', body: 'Alpha content here' },
    { name: 'Beta', project: 'TestProject', tags: ['test'], summary: 'Second entry', body: 'Beta has keyword findme' },
    { name: 'Gamma', tags: ['other'], summary: 'No project', body: 'Gamma standalone' },
  ]

  for (const e of entries) {
    const fm = ['---']
    if (e.project) fm.push(`project: ${ e.project }`)
    fm.push(`tags:\n${ e.tags.map(t => `  - ${ t }`).join('\n') }`)
    fm.push(`summary: "${ e.summary }"`)
    fm.push('---', e.body)
    writeFileSync(join(VAULT, `${ e.name }.md`), fm.join('\n'))
  }
}

// --- Runner ---

async function run () {
  console.log('Brain tests\n')

  seedVault()

  const { start } = await import('./server.js')
  const { config } = await import('./config.js')
  fastify = await start(TEST_DIR)
  if (!fastify) { console.error('start() returned null'); process.exit(1) }

  const testsDir = join(BRAIN_DIR, 'test')
  const files = readdirSync(testsDir).filter(f => f.endsWith('.js')).sort()

  let passed = 0, failed = 0

  for (const file of files) {
    console.log(`\n--- ${ file.replace('.js', '') } ---`)
    try {
      const mod = await import(`./test/${ file }`)
      await mod.default({ post, get, assert, sleep, VAULT })
      passed++
    } catch (err) {
      console.error(`  FAIL: ${ err.message }`)
      failed++
    }
  }

  await fastify.close().catch(() => {})
  rmSync(TEST_DIR, { recursive: true, force: true })
  console.log(`\n${ passed } passed, ${ failed } failed`)
  process.exit(failed > 0 ? 1 : 0)
}

run()
