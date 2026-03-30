#!/usr/bin/env node

/**
 * Restore created/modified dates from git history into frontmatter.
 * created  = date of the first commit that added the file (follows renames)
 * modified = date of the last commit that touched the file
 *
 * Usage:
 *   node scripts/git-dates.js          # dry run
 *   node scripts/git-dates.js --apply  # write
 */

import { execSync }                from 'child_process'
import fs                          from 'fs'
import path                        from 'path'
import matter                      from 'gray-matter'
import { config }                  from '../config.js'
import { orderKeys, shouldIgnore } from '../lib/utils.js'

const VAULT = config.vault
const APPLY = process.argv.includes('--apply')

function getGitDates (filePath) {
  try {
    const raw = execSync(`git log --follow --format=%aI -- "${ filePath }"`, {
      cwd: VAULT,
      encoding: 'utf-8',
    }).trim()
    if (!raw) return null
    const lines = raw.split('\n')
    return {
      created: new Date(lines[lines.length - 1]).toISOString(),
      modified: new Date(lines[0]).toISOString(),
    }
  } catch {
    return null
  }
}

console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: DRY RUN (use --apply to write)\n')

let total = 0, updated = 0, skipped = 0

function scan (dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (shouldIgnore(p, config.ignore)) continue
    if (e.isDirectory()) {
      scan(p)
      continue
    }
    if (!e.name.endsWith('.md')) continue

    total++
    const rel = path.relative(VAULT, p).replace(/\\/g, '/')
    const git = getGitDates(rel)
    if (!git) {
      skipped++
      continue
    }

    const raw = fs.readFileSync(p, 'utf-8')
    let parsed
    try { parsed = matter(raw) } catch {
      skipped++
      continue
    }

    const fm = parsed.data
    const curCreated = fm.created ? new Date(fm.created).toISOString() : null
    const curModified = fm.modified ? new Date(fm.modified).toISOString() : null

    if (curCreated === git.created && curModified === git.modified) continue

    updated++

    if (!APPLY) {
      console.log(`  ${ rel }`)
      if (curCreated !== git.created) console.log(`    created:  ${ curCreated?.slice(0, 10) || '—' } → ${ git.created.slice(0,
          10) }`)
      if (curModified !== git.modified) console.log(`    modified: ${ curModified?.slice(0, 10) ||
                                                                      '—' } → ${ git.modified.slice(0, 10) }`)
    } else {
      console.log(`  [${ updated }/${ total }] ${ rel }`)
      fm.created = new Date(git.created)
      fm.modified = new Date(git.modified)
      const ordered = orderKeys(fm, config.frontmatterHead, config.frontmatterTail)
      const out = matter.stringify(parsed.content, ordered)
      fs.writeFileSync(p, out, 'utf-8')
    }
  }
}

const t0 = Date.now()
scan(VAULT)

console.log(`\n--- Summary ---`)
console.log(`Total: ${ total }, Updated: ${ updated }, Skipped (no git): ${ skipped }`)
console.log(`Done in ${ ((Date.now() - t0) / 1000).toFixed(1) }s`)
if (APPLY && updated > 0) console.log(`Wrote ${ updated } files`)
