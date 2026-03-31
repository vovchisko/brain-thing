import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join }                     from 'node:path'
import { homedir }                  from 'node:os'
import { createBus }                from '../lib/bus.js'
import { config }                   from '../config.js'

const bus = createBus('register', { system: true })

function parseJsonPermissive (str) {
  return JSON.parse(str.replace(/,\s*([\]}])/g, '$1'))
}

function findDesktopConfig () {
  const candidates = []
  if (process.platform === 'win32') {
    if (process.env.APPDATA) candidates.push(join(process.env.APPDATA, 'Claude'))
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) {
      const pkgDir = join(localAppData, 'Packages')
      try {
        const claudePkg = readdirSync(pkgDir).find(d => d.startsWith('Claude_'))
        if (claudePkg) candidates.push(join(pkgDir, claudePkg, 'LocalCache', 'Roaming', 'Claude'))
      } catch {}
    }
  } else if (process.platform === 'darwin') {
    candidates.push(join(homedir(), 'Library', 'Application Support', 'Claude'))
  } else {
    candidates.push(join(homedir(), '.config', 'Claude'))
  }
  for (const dir of candidates) {
    const p = join(dir, 'claude_desktop_config.json')
    if (existsSync(p)) return p
  }
  return null
}

function getMcpEntry () {
  if (config.resourcesPath) {
    const ext = process.platform === 'win32' ? '.exe' : ''
    return { command: join(config.resourcesPath, `brain-mcp${ ext }`) }
  }
  return {
    command: 'node',
    args: [join(config.brainDir, '..', 'mcp', 'mcp-server.js')],
  }
}

function getConfigPaths () {
  const paths = []
  const desktopPath = findDesktopConfig()
  if (desktopPath) paths.push({ label: 'Claude Desktop', path: desktopPath })
  paths.push({ label: 'Claude Code', path: join(homedir(), '.claude.json') })
  return paths
}

function isRegistered (configPath) {
  try {
    const cfg = parseJsonPermissive(readFileSync(configPath, 'utf-8'))
    return !!cfg.mcpServers?.[config.name]
  } catch { return false }
}

async function register () {
  const entry = getMcpEntry()
  const results = []

  for (const { label, path } of getConfigPaths()) {
    const e = label === 'Claude Code' ? { ...entry, type: 'stdio' } : entry
    try {
      let cfg
      try {
        cfg = parseJsonPermissive(await readFile(path, 'utf-8'))
      } catch (err) {
        if (err.code === 'ENOENT') cfg = {}
        else throw err
      }
      if (!cfg.mcpServers) cfg.mcpServers = {}
      cfg.mcpServers[config.name] = e
      await writeFile(path, JSON.stringify(cfg, null, 2), 'utf-8')
      bus.info('register', `${ label } enabled`)
      results.push({ label, ok: true })
    } catch (err) {
      bus.error('register', `${ label }: ${ err.message }`)
      results.push({ label, ok: false, error: err.message })
    }
  }

  return results
}

async function unregister () {
  const results = []

  for (const { label, path } of getConfigPaths()) {
    try {
      let cfg
      try {
        cfg = parseJsonPermissive(await readFile(path, 'utf-8'))
      } catch (err) {
        if (err.code === 'ENOENT') { results.push({ label, ok: true }); continue }
        else throw err
      }
      if (cfg.mcpServers?.[config.name]) {
        delete cfg.mcpServers[config.name]
        await writeFile(path, JSON.stringify(cfg, null, 2), 'utf-8')
        bus.info('register', `${ label } disabled`)
      }
      results.push({ label, ok: true })
    } catch (err) {
      bus.error('register', `${ label }: ${ err.message }`)
      results.push({ label, ok: false, error: err.message })
    }
  }

  return results
}

function mcpStatus () {
  return getConfigPaths().map(({ label, path }) => ({
    label,
    registered: isRegistered(path),
  }))
}

export { register, unregister, mcpStatus }
