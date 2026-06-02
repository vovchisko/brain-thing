#!/usr/bin/env node

import { Server }                                        from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport }                          from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { APP_NAME }                                      from '../shared/constants.js'
import { SPECS }                                         from '../brain/specs.js'
import { CONSTANTS }                                     from '../brain/config.js'

const portIdx = process.argv.indexOf('--port')
const argPort = portIdx !== -1 ? Number(process.argv[portIdx + 1]) : NaN
const PORT = Number.isFinite(argPort) && argPort > 0 && argPort < 65536 ? argPort : CONSTANTS.api.port
const API_URL = `http://${ CONSTANTS.api.host }:${ PORT }`

/** Strip internal metadata (access/group) — MCP clients only need these three fields. */
const mcpTool = ({ name, description, inputSchema }) => ({ name, description, inputSchema })

let lastRev = null

const server = new Server(
  { name: APP_NAME, version: '0.0.1' },
  { capabilities: { tools: {} } },
)

// Tool list = the brain's enabled set when reachable; full static SPECS as a floor when not.
server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    const res = await fetch(`${ API_URL }/tools`)
    if (!res.ok) throw new Error(`status ${ res.status }`)
    lastRev = res.headers.get('x-tools-rev')
    const tools = await res.json()
    return { tools: tools.filter(t => t.enabled).map(mcpTool) }
  } catch {
    return { tools: SPECS.map(mcpTool) }
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  try {
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }
    const res = await fetch(`${ API_URL }/${ name }`, opts)

    // Tool toggles changed since we last looked → tell the client to re-list.
    const rev = res.headers.get('x-tools-rev')
    if (rev && rev !== lastRev) {
      lastRev = rev
      server.sendToolListChanged().catch(() => {})
    }

    const data = await res.json()
    if (!res.ok) return { content: [{ type: 'text', text: data.text || `Error: ${ res.statusText }` }], isError: true }
    return { content: [{ type: 'text', text: data.text }] }
  } catch {
    return { content: [{ type: 'text', text: "Brain Thing isn't running. Start the app and try again." }], isError: true }
  }
})

async function main () {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[brain-mcp] ready, ${ SPECS.length } tools in catalog`)
}

main().catch(err => {
  console.error(`[brain-mcp] fatal: ${ err.message }`)
  process.exit(1)
})
