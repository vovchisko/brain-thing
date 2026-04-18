#!/usr/bin/env node

import { execSync } from 'child_process'
import { cpSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'out')
const ext = process.platform === 'win32' ? '.exe' : ''
const target = resolve(root, 'out', `brain-mcp${ext}`)

mkdirSync(out, { recursive: true })

// 1. Bundle mcp-server.js + deps into single CJS file
console.log('[mcp] Bundling with esbuild...')
execSync(
  `npx esbuild src/mcp/mcp-server.js --bundle --platform=node --format=cjs --outfile=out/mcp-bundle.cjs`,
  { cwd: root, stdio: 'inherit' },
)

// 2. Generate SEA blob
console.log('[mcp] Generating SEA blob...')
execSync(
  `node --experimental-sea-config sea-config.json`,
  { cwd: root, stdio: 'inherit' },
)

// 3. Copy node binary
console.log('[mcp] Copying node binary...')
cpSync(process.execPath, target)

// 4. Inject blob (Windows uses postject via Node)
console.log('[mcp] Injecting SEA blob...')
if (process.platform === 'win32') {
  execSync(
    `npx postject "${target}" NODE_SEA_BLOB out/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    { cwd: root, stdio: 'inherit' },
  )
} else {
  // macOS/Linux: need to remove signature first on macOS
  if (process.platform === 'darwin') {
    execSync(`codesign --remove-signature "${target}"`, { stdio: 'inherit' })
  }
  execSync(
    `npx postject "${target}" NODE_SEA_BLOB out/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    { cwd: root, stdio: 'inherit' },
  )
  // macOS (esp. Apple Silicon) refuses to run unsigned Mach-O; ad-hoc sign is enough for local distribution
  if (process.platform === 'darwin') {
    execSync(`codesign --sign - --force --options runtime "${target}"`, { stdio: 'inherit' })
  }
}

console.log(`[mcp] Built: ${target}`)
