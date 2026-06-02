import fs   from 'node:fs/promises'
import os   from 'node:os'
import path from 'node:path'

const _state = { pass: 0, fail: 0 }

const c = {
  green: s => `\x1b[32m${ s }\x1b[0m`,
  red:   s => `\x1b[31m${ s }\x1b[0m`,
  cyan:  s => `\x1b[36m${ s }\x1b[0m`,
  dim:   s => `\x1b[2m${ s }\x1b[0m`,
}

export function section (label) {
  console.log(`\n${ c.cyan('▸') } ${ label }`)
}

export function ok (label, cond, extra = '') {
  if (cond) {
    _state.pass++
    console.log(`  ${ c.green('PASS') }  ${ label }${ extra ? c.dim(' — ' + extra) : '' }`)
  } else {
    _state.fail++
    console.log(`  ${ c.red('FAIL') }  ${ label }${ extra ? ' — ' + extra : '' }`)
  }
}

export function eq (label, actual, expected) {
  const cond = JSON.stringify(actual) === JSON.stringify(expected)
  ok(label, cond, cond ? '' : `expected ${ JSON.stringify(expected) }, got ${ JSON.stringify(actual) }`)
}

export async function throws (label, fn, codeOrMatcher = null) {
  try {
    await fn()
    ok(label, false, 'no error thrown')
  } catch (err) {
    if (typeof codeOrMatcher === 'string') {
      ok(label, err?.code === codeOrMatcher, `code=${ err?.code } text=${ err?.text || err?.message || '' }`)
    } else if (typeof codeOrMatcher === 'function') {
      ok(label, codeOrMatcher(err), '')
    } else {
      ok(label, true)
    }
  }
}

export function summary () {
  const total = _state.pass + _state.fail
  console.log(`\n${ _state.fail ? c.red('FAILED') : c.green('OK') } — ${ _state.pass }/${ total } passed`)
  if (_state.fail) process.exitCode = 1
}

// Tests default the id prefix to the collection name — the product requires it
// explicitly (no default), but collection names are valid, unique prefixes, so
// this keeps test schemas terse. Pass idgen in `schema` to override.
export const createCol = (db, name, schema) => db.schemas.create(name, { idgen: { prefix: name }, ...schema })
export const updateCol = (db, name, schema, renames) => db.schemas.update(name, { idgen: { prefix: name }, ...schema }, renames)

export async function tmpDir (prefix = 'dsu-test-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

export async function rmDir (dir) {
  if (dir) await fs.rm(dir, { recursive: true, force: true })
}
