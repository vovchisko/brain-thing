#!/usr/bin/env node

import { Server }                                        from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport }                          from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { config }                                        from '../brain/config.js'

import * as get        from '../brain/mcp/get.js'
import * as whatIs     from '../brain/mcp/what_is.js'
import * as grep       from '../brain/mcp/grep.js'
import * as lookAround from '../brain/mcp/look_around.js'
import * as tagsList   from '../brain/mcp/tags_list.js'
import * as create     from '../brain/mcp/create.js'
import * as update     from '../brain/mcp/update.js'
import * as replace    from '../brain/mcp/replace.js'
import * as insert     from '../brain/mcp/insert.js'
import * as del        from '../brain/mcp/delete.js'
import * as rename     from '../brain/mcp/rename.js'
import * as fields     from '../brain/mcp/fields.js'
import * as search     from '../brain/mcp/search.js'
import * as narrate    from '../brain/mcp/narrate.js'
import * as diagnostic from '../brain/mcp/diagnostic.js'

const allTools = [
  get, whatIs, grep, lookAround, tagsList,
  create, update, replace, insert, del, rename,
  fields, search, narrate, diagnostic,
]

const API_URL = `http://${ config.api.host }:${ config.api.port }`

const routes = Object.fromEntries(allTools.map(t => [ t.tool.name, t.route ]))

let enabledFeatures = null

async function fetchFeatures () {
  try {
    const res = await fetch(`${ API_URL }/features`)
    return await res.json()
  } catch {
    return {}
  }
}

function getEnabledTools (features) {
  return allTools
      .filter(t => !t.feature || features[t.feature])
      .map(t => t.tool)
}

const mcpServer = new Server(
    { name: config.name, version: '1.1.0' },
    { capabilities: { tools: {} } },
)

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  if (!enabledFeatures) enabledFeatures = await fetchFeatures()
  return { tools: getEnabledTools(enabledFeatures) }
})

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  const route = routes[name]
  if (!route) {
    throw new Error(`Unknown tool: ${ name }`)
  }

  const body = route.transform ? route.transform(args) : args

  const fetchOptions = {
    method: route.method,
    headers: { 'Content-Type': 'application/json' },
  }

  if (route.method === 'POST') {
    fetchOptions.body = JSON.stringify(body)
  }

  const apiResponse = await fetch(`${ API_URL }/${ route.path }`, fetchOptions)
  const data = await apiResponse.json()

  if (!apiResponse.ok) {
    return { content: [ { type: 'text', text: data.text || `Error: ${ apiResponse.statusText }` } ], isError: true }
  }

  return { content: [ { type: 'text', text: data.text } ] }
})

async function main () {
  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)
}

main()
