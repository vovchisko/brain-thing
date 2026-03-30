import { readFile, writeFile } from 'node:fs/promises'
import { join }                from 'node:path'
import { homedir }             from 'node:os'
import { createBus } from '../lib/bus.js'
import { config }    from '../config.js'

const bus = createBus('register', { system: true })

function getClaudeDesktopConfigPath () {
  const home = homedir()
  if (process.platform === 'win32') {
    return join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json')
  } else if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  } else {
    return join(home, '.config', 'Claude', 'claude_desktop_config.json')
  }
}

function getClaudeCodeConfigPath () {
  return join(homedir(), '.claude.json')
}

function getMcpEntry (forClaudeCode) {
  if (config.resourcesPath) {
    const ext = process.platform === 'win32' ? '.exe' : ''
    const entry = { command: join(config.resourcesPath, `brain-mcp${ ext }`) }
    if (forClaudeCode) entry.type = 'stdio'
    return entry
  }
  const entry = {
    command: 'node',
    args: [ join(config.brainDir, '..', 'mcp', 'mcp-server.js') ],
  }
  if (forClaudeCode) entry.type = 'stdio'
  return entry
}

async function upsertConfig (configPath, label, mcpEntry) {
  let cfg
  try {
    cfg = JSON.parse(await readFile(configPath, 'utf-8'))
  } catch (err) {
    if (err.code === 'ENOENT') {
      cfg = {}
    } else {
      bus.error('config', `Failed to read ${ label } config: ${ err.message }`)
      return
    }
  }

  if (!cfg.mcpServers) cfg.mcpServers = {}
  cfg.mcpServers[config.name] = mcpEntry

  await writeFile(configPath, JSON.stringify(cfg, null, 2), 'utf-8')
  bus.info('config', `${ label } config updated`)
}

async function register () {
  const desktopPath = getClaudeDesktopConfigPath()
  const codePath = getClaudeCodeConfigPath()
  const desktopEntry = getMcpEntry(false)
  const codeEntry = getMcpEntry(true)

  bus.info('register', `Registering "${ config.name }"`)
  bus.info('register', `MCP: ${ desktopEntry.command } ${ (desktopEntry.args || []).join(' ') }`)

  await upsertConfig(desktopPath, 'Claude Desktop', desktopEntry)
  await upsertConfig(codePath, 'Claude Code', codeEntry)
}

export { register }
