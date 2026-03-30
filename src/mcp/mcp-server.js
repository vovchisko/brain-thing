#!/usr/bin/env node

import { Server }                                        from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport }                          from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const API_URL = 'http://127.0.0.1:43000'

const LOOK_AROUND = {
  name: 'look_around',
  description: 'Start here. Shows knowledge base overview: scopes, tags, entry count, and guidelines. Also syncs available tools — call this when other tools are missing.',
  inputSchema: { type: 'object', properties: {} },
}

let tools = []

async function syncTools () {
  try {
    const res = await fetch(`${ API_URL }/tools`)
    tools = await res.json()
    return tools.length
  } catch {
    tools = []
    return 0
  }
}

const server = new Server(
  { name: 'brain-thing', version: '0.0.1' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [LOOK_AROUND, ...tools.filter(t => t.name !== 'look_around')] }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'look_around') {
    const count = await syncTools()
    await server.sendToolListChanged()
    if (count === 0) {
      return { content: [{ type: 'text', text: "Brain Thing isn't running. Start the app and try again." }], isError: true }
    }
  }

  try {
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }
    const res = await fetch(`${ API_URL }/${ name }`, opts)
    const data = await res.json()
    if (!res.ok) return { content: [{ type: 'text', text: data.text || `Error: ${ res.statusText }` }], isError: true }
    return { content: [{ type: 'text', text: data.text }] }
  } catch {
    tools = []
    await server.sendToolListChanged()
    return { content: [{ type: 'text', text: 'Brain Thing stopped responding. Call look_around to reconnect.' }], isError: true }
  }
})

await syncTools()
const transport = new StdioServerTransport()
await server.connect(transport)
